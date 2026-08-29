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
    getActiveAndroidChatHeadSessionId,
} from '@/utils/androidChatHeads';
import { drainAndroidChatHeadReplies } from '@/utils/androidChatHeadReplyTask';

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
                void drainAndroidChatHeadReplies(activeSessionId);
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
                void drainAndroidChatHeadReplies(nextSessionId);
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
            messages,
            session.thinking,
        );
    }, [isLoaded, messages, profilePicture, session, sessionId]);

    return null;
}
