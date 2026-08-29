import sodium from '@/encryption/libsodium.lib';
import { TokenStorage } from '@/auth/tokenStorage';
import { sync, syncRestoreForChatHead } from '@/sync/sync';
import { storage } from '@/sync/storage';
import { getSessionName } from '@/utils/sessionUtils';
import {
    acknowledgeAndroidChatHeadPendingReply,
    cacheAndroidChatHeadSession,
    consumeAndroidChatHeadPendingReplies,
} from '@/utils/androidChatHeads';

export const ANDROID_CHAT_HEAD_REPLY_TASK = 'HappyChatHeadReplyTask';

const drainingSessions = new Set<string>();

const CHAT_HEAD_RESPONSE_WAIT_MS = 110_000;
const CHAT_HEAD_REFRESH_INTERVAL_MS = 2_500;

function countVisibleIncomingMessages(sessionId: string): number {
    return storage.getState().sessionMessages[sessionId]?.messages.filter((message) => (
        (message.kind === 'agent-text' && !message.isThinking && message.text.trim().length > 0)
        || (message.kind === 'tool-call' && message.tool.name === 'file')
    )).length ?? 0;
}

async function keepChatHeadSyncedThroughResponse(sessionId: string, baselineIncoming: number) {
    const startedAt = Date.now();
    const deadline = startedAt + CHAT_HEAD_RESPONSE_WAIT_MS;
    let nextRefreshAt = startedAt + 1_000;
    let latestIncoming = baselineIncoming;
    let latestChangeAt = startedAt;
    let sawWorking = storage.getState().sessions[sessionId]?.thinking === true;

    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const now = Date.now();
        if (now >= nextRefreshAt) {
            try {
                await sync.refreshChatHeadSession(sessionId);
            } catch (error) {
                console.warn(`[chat-head] ${sessionId}: response refresh failed`, error);
            }
            nextRefreshAt = Date.now() + CHAT_HEAD_REFRESH_INTERVAL_MS;
        }

        const state = storage.getState();
        const isWorking = state.sessions[sessionId]?.thinking === true;
        sawWorking ||= isWorking;
        const incoming = countVisibleIncomingMessages(sessionId);
        if (incoming > latestIncoming) {
            latestIncoming = incoming;
            latestChangeAt = Date.now();
        }

        const receivedResponse = incoming > baselineIncoming;
        if (receivedResponse && sawWorking && !isWorking) {
            console.warn(`[chat-head] ${sessionId}: complete response synced in ${Date.now() - startedAt}ms`);
            return;
        }
        if (receivedResponse && !sawWorking && Date.now() - latestChangeAt >= 8_000) {
            console.warn(`[chat-head] ${sessionId}: response synced after quiet period in ${Date.now() - startedAt}ms`);
            return;
        }
    }

    console.warn(`[chat-head] ${sessionId}: response sync wait reached its time limit`);
}

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

        const baselineIncoming = countVisibleIncomingMessages(sessionId);
        let sentReply = false;
        while (true) {
            const replies = await consumeAndroidChatHeadPendingReplies(sessionId);
            console.warn(`[chat-head] ${sessionId}: found ${replies.length} pending replies`);
            if (replies.length === 0) {
                break;
            }
            for (const reply of replies) {
                sentReply = true;
                console.warn(`[chat-head] ${sessionId}: sending ${reply.id}`);
                await sync.sendChatHeadMessage(sessionId, reply.text);
                console.warn(`[chat-head] ${sessionId}: acknowledging ${reply.id}`);
                await acknowledgeAndroidChatHeadPendingReply(sessionId, reply.id);
            }
        }

        if (sentReply) {
            await keepChatHeadSyncedThroughResponse(sessionId, baselineIncoming);
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
