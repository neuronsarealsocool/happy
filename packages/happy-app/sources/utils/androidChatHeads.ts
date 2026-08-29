import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { Message } from '@/sync/typesMessage';
import type { Session } from '@/sync/storageTypes';
import { getSessionName } from '@/utils/sessionUtils';

type HappyChatHeadsModule = {
    canDrawOverlays: () => Promise<boolean>;
    openOverlaySettings: () => void;
    canReadNotifications: () => Promise<boolean>;
    openNotificationListenerSettings: () => void;
    showTestChatHead: (title?: string, body?: string, sessionId?: string, avatarUri?: string) => void;
    cacheSession: (sessionId: string, title: string, avatarUri: string, messagesJson: string | undefined, isWorking: boolean) => void;
    consumePendingReplies: (sessionId: string) => Promise<string>;
    acknowledgePendingReply: (sessionId: string, replyId: string) => Promise<void>;
    getActiveSessionId: () => Promise<string>;
    addListener: (eventName: string) => void;
    removeListeners: (count: number) => void;
};

const nativeModule = NativeModules.HappyChatHeads as HappyChatHeadsModule | undefined;
const nativeEvents = Platform.OS === 'android' && nativeModule
    ? new NativeEventEmitter(nativeModule)
    : null;

export const ANDROID_CHAT_HEAD_OPENED_EVENT = 'HappyChatHeadOpened';
export const ANDROID_CHAT_HEAD_REPLY_EVENT = 'HappyChatHeadReplyQueued';

export async function getActiveAndroidChatHeadSessionId(): Promise<string> {
    if (Platform.OS !== 'android' || !nativeModule) {
        return '';
    }
    return (await nativeModule.getActiveSessionId())?.trim() ?? '';
}

export function addAndroidChatHeadListener(
    eventName: typeof ANDROID_CHAT_HEAD_OPENED_EVENT | typeof ANDROID_CHAT_HEAD_REPLY_EVENT,
    listener: (event: { sessionId?: string }) => void
) {
    return nativeEvents?.addListener(eventName, listener) ?? null;
}

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
    messages: Message[],
    isWorking = false,
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
            if (message.kind === 'tool-call' && message.tool.name === 'file') {
                const name = typeof message.tool.input?.name === 'string'
                    ? message.tool.input.name.trim()
                    : '';
                const text = name || message.tool.description?.replace(/^Attached (?:file|image):\s*/i, '').trim();
                return text ? [{ text: `Attachment: ${text}`, outgoing: false, attachment: true }] : [];
            }
            return [];
        });

    nativeModule.cacheSession(
        sessionId,
        title,
        avatarUri ?? '',
        JSON.stringify(chatMessages),
        isWorking,
    );
}

export function cacheAndroidChatHeadSessionSummaries(
    sessions: Session[],
    sessionProfilePictures: Record<string, string>,
    legacySessionProfilePictures: Record<string, string>
) {
    if (Platform.OS !== 'android' || !nativeModule) {
        return;
    }

    sessions.forEach((session) => {
        if (!session.id || session.metadata?.isSideChat) {
            return;
        }
        nativeModule.cacheSession(
            session.id,
            getSessionName(session),
            sessionProfilePictures[session.id] ?? legacySessionProfilePictures[session.id] ?? '',
            undefined,
            session.thinking,
        );
    });
}

export type AndroidChatHeadPendingReply = {
    id: string;
    text: string;
    createdAt: number;
};

export async function consumeAndroidChatHeadPendingReplies(sessionId: string): Promise<AndroidChatHeadPendingReply[]> {
    if (Platform.OS !== 'android' || !nativeModule || !sessionId) {
        return [];
    }

    const raw = await nativeModule.consumePendingReplies(sessionId);
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.flatMap((item) => {
            const text = typeof item?.text === 'string' ? item.text.trim() : '';
            if (!text) {
                return [];
            }
            return [{
                id: typeof item?.id === 'string' ? item.id : `${Date.now()}`,
                text,
                createdAt: typeof item?.createdAt === 'number' ? item.createdAt : Date.now(),
            }];
        });
    } catch {
        return [];
    }
}

export async function acknowledgeAndroidChatHeadPendingReply(sessionId: string, replyId: string): Promise<void> {
    if (Platform.OS !== 'android' || !nativeModule || !sessionId || !replyId) {
        return;
    }
    await nativeModule.acknowledgePendingReply(sessionId, replyId);
}
