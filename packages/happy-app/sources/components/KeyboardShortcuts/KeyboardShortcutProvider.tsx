import * as React from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Modal } from '@/modal';
import { storage } from '@/sync/storage';
import {
    eventToShortcutBinding,
    findShortcutAction,
    formatShortcut,
    getShortcutBindingForAction,
    KEYBOARD_SHORTCUT_DEFINITIONS,
    type KeyboardShortcutActionId,
} from '@/utils/keyboardShortcuts';

type ShortcutHandler = () => void | Promise<void>;

type KeyboardShortcutContextValue = {
    registerShortcutHandler: (id: KeyboardShortcutActionId, handler: ShortcutHandler) => () => void;
    runShortcutAction: (id: KeyboardShortcutActionId) => boolean;
    getShortcutLabel: (id: KeyboardShortcutActionId) => string;
};

const KeyboardShortcutContext = React.createContext<KeyboardShortcutContextValue | null>(null);

export function KeyboardShortcutProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const handlersRef = React.useRef(new Map<KeyboardShortcutActionId, ShortcutHandler[]>());

    const runShortcutAction = React.useCallback((id: KeyboardShortcutActionId): boolean => {
        const registeredHandlers = handlersRef.current.get(id);
        const registered = registeredHandlers?.[registeredHandlers.length - 1];
        if (registered) {
            void registered();
            return true;
        }

        if (id === 'app.newSession') {
            router.navigate('/new');
            return true;
        }
        if (id === 'app.openSettings') {
            router.push('/settings');
            return true;
        }
        if (id === 'app.showShortcuts') {
            router.push('/settings/accessibility');
            return true;
        }
        if (id === 'app.focusSidebar') {
            return focusFirstElement('[data-happy-sidebar]');
        }
        if (id === 'app.focusTranscript' || id === 'message.previous' || id === 'message.next') {
            return focusFirstElement('[data-happy-transcript]');
        }

        return false;
    }, [router]);

    const registerShortcutHandler = React.useCallback((id: KeyboardShortcutActionId, handler: ShortcutHandler) => {
        const current = handlersRef.current.get(id) ?? [];
        handlersRef.current.set(id, [...current, handler]);
        return () => {
            const handlers = handlersRef.current.get(id);
            if (!handlers) return;
            const next = handlers.filter((item) => item !== handler);
            if (next.length > 0) {
                handlersRef.current.set(id, next);
            } else {
                handlersRef.current.delete(id);
            }
        };
    }, []);

    const getShortcutLabel = React.useCallback((id: KeyboardShortcutActionId) => {
        const settings = storage.getState().settings;
        return formatShortcut(getShortcutBindingForAction(id, settings.keyboardShortcutOverrides));
    }, []);

    React.useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const settings = storage.getState().settings;
            if (!settings.keyboardShortcutsEnabled) return;

            const action = findShortcutAction(
                eventToShortcutBinding(event),
                settings.keyboardShortcutOverrides,
                'global',
            );
            if (!action) return;

            event.preventDefault();
            event.stopPropagation();
            runShortcutAction(action.id);
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [runShortcutAction]);

    const value = React.useMemo<KeyboardShortcutContextValue>(() => ({
        registerShortcutHandler,
        runShortcutAction,
        getShortcutLabel,
    }), [getShortcutLabel, registerShortcutHandler, runShortcutAction]);

    return (
        <KeyboardShortcutContext.Provider value={value}>
            {children}
        </KeyboardShortcutContext.Provider>
    );
}

export function useKeyboardShortcuts() {
    const value = React.useContext(KeyboardShortcutContext);
    if (!value) {
        return {
            registerShortcutHandler: () => () => {},
            runShortcutAction: () => false,
            getShortcutLabel: (id: KeyboardShortcutActionId) => {
                const definition = KEYBOARD_SHORTCUT_DEFINITIONS.find((item) => item.id === id);
                return definition ? formatShortcut(definition.defaultBinding) : '';
            },
        } satisfies KeyboardShortcutContextValue;
    }
    return value;
}

function focusFirstElement(selector: string): boolean {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
    const root = document.querySelector(selector);
    if (!(root instanceof HTMLElement)) return false;
    const target = root.matches(focusableSelector)
        ? root
        : root.querySelector(focusableSelector);
    if (!(target instanceof HTMLElement)) {
        root.focus();
        return document.activeElement === root;
    }
    target.focus();
    return document.activeElement === target;
}

const focusableSelector = [
    'button',
    'a[href]',
    'input',
    'textarea',
    'select',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export function showKeyboardShortcutCheatsheet() {
    const settings = storage.getState().settings;
    const lines = KEYBOARD_SHORTCUT_DEFINITIONS.map((definition) => (
        `${formatShortcut(getShortcutBindingForAction(definition.id, settings.keyboardShortcutOverrides))}: ${definition.label}`
    ));
    Modal.alert('Keyboard shortcuts', lines.join('\n'));
}
