import sodium from '@/encryption/libsodium.lib';
import { TokenStorage } from '@/auth/tokenStorage';
import { sync, syncRestoreForChatHead } from '@/sync/sync';
import {
    acknowledgeAndroidChatHeadPendingReply,
    consumeAndroidChatHeadPendingReplies,
} from '@/utils/androidChatHeads';

export const ANDROID_CHAT_HEAD_REPLY_TASK = 'HappyChatHeadReplyTask';

const drainingSessions = new Set<string>();

export async function drainAndroidChatHeadReplies(sessionId: string) {
    if (!sessionId || drainingSessions.has(sessionId)) {
        return;
    }

    drainingSessions.add(sessionId);
    try {
        await sodium.ready;
        const credentials = await TokenStorage.getCredentials();
        if (!credentials) {
            throw new Error('Happy is not signed in');
        }
        await syncRestoreForChatHead(credentials, sessionId);

        while (true) {
            const replies = await consumeAndroidChatHeadPendingReplies(sessionId);
            if (replies.length === 0) {
                break;
            }
            for (const reply of replies) {
                await sync.sendChatHeadMessage(sessionId, reply.text);
                await acknowledgeAndroidChatHeadPendingReply(sessionId, reply.id);
            }
        }
    } finally {
        drainingSessions.delete(sessionId);
    }
}

export async function runAndroidChatHeadReplyTask(data: { sessionId?: unknown }) {
    const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
    if (!sessionId) {
        return;
    }
    console.log(`[chat-head] Headless reply task started for ${sessionId}`);
    try {
        await drainAndroidChatHeadReplies(sessionId);
        console.log(`[chat-head] Headless reply task completed for ${sessionId}`);
    } catch (error) {
        console.error(`[chat-head] Headless reply task failed for ${sessionId}`, error);
        throw error;
    }
}
