import * as React from 'react';
import { Platform } from 'react-native';
import { useSession, useSessionMessages } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { getSessionName } from '@/utils/sessionUtils';
import { useSessionProfilePicture } from '@/utils/sessionProfilePictures';
import {
    addAndroidChatHeadListener,
    ANDROID_CHAT_HEAD_OPENED_EVENT,
    ANDROID_CHAT_HEAD_REPLY_EVENT,
    cacheAndroidChatHeadSession,
    consumeAndroidChatHeadPendingReplies,
    getActiveAndroidChatHeadSessionId,
} from '@/utils/androidChatHeads';

const drainingSessions = new Set<string>();

async function drainReplies(sessionId: string) {
    if (!sessionId || drainingSessions.has(sessionId)) {
        return;
    }
    drainingSessions.add(sessionId);
    try {
        while (true) {
            const replies = await consumeAndroidChatHeadPendingReplies(sessionId);
            if (replies.length === 0) {
                break;
            }
            for (const reply of replies) {
                await sync.sendMessage(sessionId, reply.text, { source: 'chat' });
            }
        }
    } finally {
        drainingSessions.delete(sessionId);
    }
}

export function AndroidChatHeadBridge() {
    const [sessionId, setSessionId] = React.useState('');
    const session = useSession(sessionId);
    const { messages, isLoaded } = useSessionMessages(sessionId);
    const profilePicture = useSessionProfilePicture(sessionId);

    React.useEffect(() => {
        if (Platform.OS !== 'android') {
            return;
        }

        let cancelled = false;
        void getActiveAndroidChatHeadSessionId().then((activeSessionId) => {
            if (!cancelled && activeSessionId) {
                setSessionId(activeSessionId);
                sync.onSessionVisible(activeSessionId);
                void drainReplies(activeSessionId);
            }
        });

        const openedSubscription = addAndroidChatHeadListener(ANDROID_CHAT_HEAD_OPENED_EVENT, (event) => {
            const nextSessionId = event.sessionId?.trim() ?? '';
            if (nextSessionId) {
                setSessionId(nextSessionId);
                sync.onSessionVisible(nextSessionId);
            }
        });
        const replySubscription = addAndroidChatHeadListener(ANDROID_CHAT_HEAD_REPLY_EVENT, (event) => {
            const nextSessionId = event.sessionId?.trim() ?? '';
            if (nextSessionId) {
                setSessionId(nextSessionId);
                sync.onSessionVisible(nextSessionId);
                void drainReplies(nextSessionId);
            }
        });

        return () => {
            cancelled = true;
            openedSubscription?.remove();
            replySubscription?.remove();
        };
    }, []);

    React.useEffect(() => {
        if (!sessionId || !session || !isLoaded) {
            return;
        }
        cacheAndroidChatHeadSession(
            sessionId,
            getSessionName(session),
            profilePicture,
            messages
        );
    }, [isLoaded, messages, profilePicture, session, sessionId]);

    return null;
}
