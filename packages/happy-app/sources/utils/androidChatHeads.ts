import { NativeModules, Platform } from 'react-native';
import type { Message } from '@/sync/typesMessage';

type HappyChatHeadsModule = {
    canDrawOverlays: () => Promise<boolean>;
    openOverlaySettings: () => void;
    canReadNotifications: () => Promise<boolean>;
    openNotificationListenerSettings: () => void;
    showTestChatHead: (title?: string, body?: string, sessionId?: string, avatarUri?: string) => void;
    cacheSession: (sessionId: string, title?: string, avatarUri?: string, messagesJson?: string) => void;
};

const nativeModule = NativeModules.HappyChatHeads as HappyChatHeadsModule | undefined;

export async function canUseAndroidChatHeads(): Promise<boolean> {
    if (Platform.OS !== 'android' || !nativeModule) {
        return false;
    }
    return nativeModule.canDrawOverlays();
}

export function openAndroidChatHeadSettings() {
    if (Platform.OS !== 'android' || !nativeModule) {
        return;
    }
    nativeModule.openOverlaySettings();
}

export async function canUseAndroidNotificationAccess(): Promise<boolean> {
    if (Platform.OS !== 'android' || !nativeModule) {
        return false;
    }
    return nativeModule.canReadNotifications();
}

export function openAndroidNotificationAccessSettings() {
    if (Platform.OS !== 'android' || !nativeModule) {
        return;
    }
    nativeModule.openNotificationListenerSettings();
}

export function showAndroidChatHeadPreview() {
    if (Platform.OS !== 'android' || !nativeModule) {
        return;
    }
    nativeModule.showTestChatHead(
        'Happy',
        'Chat heads are ready. New notifications can pop over other apps.',
        '',
        ''
    );
}

export function cacheAndroidChatHeadSession(
    sessionId: string,
    title: string,
    avatarUri: string | null | undefined,
    messages: Message[]
) {
    if (Platform.OS !== 'android' || !nativeModule || !sessionId) {
        return;
    }

    const chatMessages = [...messages]
        .sort((a, b) => a.createdAt - b.createdAt)
        .flatMap((message) => {
            if (message.kind === 'user-text') {
                const text = (message.displayText ?? message.text).trim();
                return text ? [{ text, outgoing: true }] : [];
            }
            if (message.kind === 'agent-text' && !message.isThinking) {
                const text = message.text.trim();
                return text ? [{ text, outgoing: false }] : [];
            }
            return [];
        })
        .slice(-12);

    nativeModule.cacheSession(
        sessionId,
        title,
        avatarUri ?? '',
        JSON.stringify(chatMessages)
    );
}
