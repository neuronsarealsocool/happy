import sodium from '@/encryption/libsodium.lib';
import { TokenStorage } from '@/auth/tokenStorage';
import { sync, syncRestoreForChatHead } from '@/sync/sync';
import { storage } from '@/sync/storage';
import { getSessionName } from '@/utils/sessionUtils';
import {
    acknowledgeAndroidChatHeadPendingReply,
    acknowledgeAndroidChatHeadPendingAttachment,
    cacheAndroidChatHeadSession,
    consumeAndroidChatHeadPendingAttachments,
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
        console.warn(`[chat-head] ${sessionId}: waiting for encryption`);
        await sodium.ready;
        const credentials = await TokenStorage.getCredentials();
        if (!credentials) {
            throw new Error('Happy is not signed in');
        }
        console.warn(`[chat-head] ${sessionId}: restoring targeted sync`);
        await syncRestoreForChatHead(credentials, sessionId);
        console.warn(`[chat-head] ${sessionId}: targeted sync ready`);

        while (true) {
            const replies = await consumeAndroidChatHeadPendingReplies(sessionId);
            const attachments = await consumeAndroidChatHeadPendingAttachments(sessionId);
            console.warn(`[chat-head] ${sessionId}: found ${replies.length} pending replies`);
            if (replies.length === 0 && attachments.length === 0) {
                break;
            }
            if (attachments.length > 0) {
                console.warn(`[chat-head] ${sessionId}: sending ${attachments.length} attachment(s)`);
                await sync.sendChatHeadMessage(sessionId, '', attachments);
                for (const attachment of attachments) {
                    await acknowledgeAndroidChatHeadPendingAttachment(sessionId, attachment.id);
                }
            }
            for (const reply of replies) {
                console.warn(`[chat-head] ${sessionId}: sending ${reply.id}`);
                await sync.sendChatHeadMessage(sessionId, reply.text);
                console.warn(`[chat-head] ${sessionId}: acknowledging ${reply.id}`);
                await acknowledgeAndroidChatHeadPendingReply(sessionId, reply.id);
            }
        }

    } finally {
        drainingSessions.delete(sessionId);
    }
}

async function refreshAndroidChatHeadSession(sessionId: string) {
    await sodium.ready;
    const credentials = await TokenStorage.getCredentials();
    if (!credentials) {
        throw new Error('Happy is not signed in');
    }
    await syncRestoreForChatHead(credentials, sessionId);
    await sync.refreshChatHeadSession(sessionId);
    const state = storage.getState();
    const session = state.sessions[sessionId];
    const messages = state.sessionMessages[sessionId]?.messages;
    if (session && messages) {
        cacheAndroidChatHeadSession(
            sessionId,
            getSessionName(session),
            '',
            messages,
            session.thinking,
        );
    }
}

export async function runAndroidChatHeadReplyTask(data: { sessionId?: unknown; refresh?: unknown }) {
    const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
    if (!sessionId) {
        return;
    }
    console.log(`[chat-head] Headless reply task started for ${sessionId}`);
    try {
        if (data.refresh === true) {
            await refreshAndroidChatHeadSession(sessionId);
        } else {
            await drainAndroidChatHeadReplies(sessionId);
        }
        console.log(`[chat-head] Headless reply task completed for ${sessionId}`);
    } catch (error) {
        console.error(`[chat-head] Headless reply task failed for ${sessionId}`, error);
        throw error;
    }
}
