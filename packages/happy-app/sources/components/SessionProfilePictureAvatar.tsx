import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Avatar } from './Avatar';
import { pickAndSaveSessionProfilePicture, useSessionProfilePicture } from '@/utils/sessionProfilePictures';

interface SessionProfilePictureAvatarProps {
    sessionId: string;
    avatarId: string;
    size: number;
    monochrome?: boolean;
    flavor?: string | null;
    clientId?: string | null;
    editable?: boolean;
}

export function SessionProfilePictureAvatar({
    sessionId,
    avatarId,
    size,
    monochrome,
    flavor,
    clientId,
    editable = false,
}: SessionProfilePictureAvatarProps) {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const imageUrl = useSessionProfilePicture(sessionId);
    const [active, setActive] = React.useState(false);

    const handlePress = React.useCallback((event?: any) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        void pickAndSaveSessionProfilePicture(sessionId);
    }, [sessionId]);

    const avatar = (
        <Avatar
            id={avatarId}
            size={size}
            monochrome={monochrome}
            flavor={flavor}
            clientId={clientId}
            imageUrl={imageUrl}
        />
    );

    if (!editable) {
        return avatar;
    }

    return (
        <Pressable
            accessibilityLabel="Change conversation picture"
            accessibilityRole="button"
            hitSlop={6}
            onBlur={() => setActive(false)}
            onFocus={() => setActive(true)}
            // @ts-ignore - Web hover events are supported by react-native-web.
            onMouseEnter={() => setActive(true)}
            // @ts-ignore - Web hover events are supported by react-native-web.
            onMouseLeave={() => setActive(false)}
            onPress={handlePress}
            style={[
                styles.button,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
            ]}
        >
            {avatar}
            {Platform.OS === 'web' && (
                <View
                    pointerEvents="none"
                    style={[
                        styles.overlay,
                        {
                            opacity: active ? 1 : 0,
                            borderRadius: size / 2,
                            backgroundColor: theme.dark ? 'rgba(0, 0, 0, 0.56)' : 'rgba(0, 0, 0, 0.44)',
                        },
                    ]}
                >
                    <Ionicons name="camera-outline" size={Math.max(14, Math.round(size * 0.38))} color="#FFFFFF" />
                </View>
            )}
        </Pressable>
    );
}

const stylesheet = StyleSheet.create(() => ({
    button: {
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
}));
