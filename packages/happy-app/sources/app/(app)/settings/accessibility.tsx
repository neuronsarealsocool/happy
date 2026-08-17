import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Item } from '@/components/Item';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Switch } from '@/components/Switch';
import { Modal } from '@/modal';
import { useSettingMutable } from '@/sync/storage';
import {
    eventToShortcutBinding,
    formatShortcut,
    getShortcutBindingForAction,
    KEYBOARD_SHORTCUT_DEFINITIONS,
    validateShortcutBinding,
    type KeyboardShortcutActionId,
    type KeyboardShortcutBinding,
    type KeyboardShortcutOverrides,
} from '@/utils/keyboardShortcuts';

export default function AccessibilitySettingsScreen() {
    const [enabled, setEnabled] = useSettingMutable('keyboardShortcutsEnabled');
    const [overrides, setOverrides] = useSettingMutable('keyboardShortcutOverrides');

    const setShortcut = React.useCallback((id: KeyboardShortcutActionId, binding: KeyboardShortcutBinding | null) => {
        setOverrides({
            ...(overrides as KeyboardShortcutOverrides),
            [id]: binding,
        } as any);
    }, [overrides, setOverrides]);

    const resetShortcut = React.useCallback((id: KeyboardShortcutActionId) => {
        const next = { ...(overrides as KeyboardShortcutOverrides) };
        delete next[id];
        setOverrides(next as any);
    }, [overrides, setOverrides]);

    const resetAll = React.useCallback(() => {
        setOverrides({} as any);
    }, [setOverrides]);

    return (
        <ItemList style={{ paddingTop: 0 }}>
            <ItemGroup
                title="Accessibility"
                footer="Shortcuts are optimized for Microsoft Edge on Windows and synced with your Happy account."
            >
                <Item
                    title="Keyboard shortcuts"
                    subtitle={enabled ? 'Enabled' : 'Disabled'}
                    icon={<Ionicons name="keypad-outline" size={29} color="#007AFF" />}
                    rightElement={<Switch value={enabled} onValueChange={setEnabled} />}
                    showChevron={false}
                />
            </ItemGroup>

            {groupedDefinitions().map(([category, definitions]) => (
                <ItemGroup key={category} title={category}>
                    {definitions.map((definition) => {
                        const binding = getShortcutBindingForAction(definition.id, overrides as KeyboardShortcutOverrides);
                        const isCustomized = Object.prototype.hasOwnProperty.call(overrides ?? {}, definition.id);
                        return (
                            <ShortcutItem
                                key={definition.id}
                                actionId={definition.id}
                                title={definition.label}
                                detail={formatShortcut(binding)}
                                customized={isCustomized}
                                disabled={!enabled}
                                onSet={(nextBinding) => setShortcut(definition.id, nextBinding)}
                                onReset={() => resetShortcut(definition.id)}
                                overrides={overrides as KeyboardShortcutOverrides}
                            />
                        );
                    })}
                </ItemGroup>
            ))}

            <ItemGroup footer="Reset restores the Edge-safe defaults. Assigning a reserved Edge shortcut is blocked.">
                <Item
                    title="Reset all shortcuts"
                    icon={<Ionicons name="refresh-outline" size={29} color="#FF9500" />}
                    onPress={resetAll}
                    showChevron={false}
                />
            </ItemGroup>
        </ItemList>
    );
}

function ShortcutItem({
    actionId,
    title,
    detail,
    customized,
    disabled,
    overrides,
    onSet,
    onReset,
}: {
    actionId: KeyboardShortcutActionId;
    title: string;
    detail: string;
    customized: boolean;
    disabled: boolean;
    overrides: KeyboardShortcutOverrides;
    onSet: (binding: KeyboardShortcutBinding | null) => void;
    onReset: () => void;
}) {
    const { theme } = useUnistyles();
    const [recording, setRecording] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!recording || Platform.OS !== 'web' || typeof window === 'undefined') return;

        const onKeyDown = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === 'Escape') {
                setRecording(false);
                setError(null);
                return;
            }

            if (event.key === 'Backspace' || event.key === 'Delete') {
                onSet(null);
                setRecording(false);
                setError(null);
                return;
            }

            const binding = eventToShortcutBinding(event);
            const validation = validateShortcutBinding(actionId, binding, overrides);
            if (!validation.ok) {
                setError(validation.reason);
                return;
            }

            onSet(binding);
            setRecording(false);
            setError(null);
        };

        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [actionId, onSet, overrides, recording]);

    return (
        <View>
            <Item
                title={title}
                subtitle={recording ? 'Press a shortcut. Escape cancels. Delete clears.' : error ?? (customized ? 'Customized' : undefined)}
                detail={recording ? 'Recording...' : detail}
                disabled={disabled}
                icon={<Ionicons name="key-outline" size={29} color={disabled ? theme.colors.textSecondary : '#34C759'} />}
                onPress={() => {
                    setRecording(true);
                    setError(null);
                }}
                rightElement={customized ? (
                    <Pressable
                        accessibilityLabel={`Reset ${title}`}
                        onPress={onReset}
                        style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
                    >
                        <Text style={styles.resetText}>Reset</Text>
                    </Pressable>
                ) : undefined}
            />
        </View>
    );
}

function groupedDefinitions() {
    const groups = new Map<string, typeof KEYBOARD_SHORTCUT_DEFINITIONS>();
    for (const definition of KEYBOARD_SHORTCUT_DEFINITIONS) {
        const current = groups.get(definition.category) ?? [];
        current.push(definition);
        groups.set(definition.category, current);
    }
    return Array.from(groups.entries());
}

const styles = StyleSheet.create((theme) => ({
    resetButton: {
        minHeight: 34,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: theme.colors.surfacePressed,
    },
    resetText: {
        color: theme.colors.textLink,
        fontSize: 13,
        fontWeight: '600',
    },
    pressed: {
        opacity: 0.65,
    },
}));

