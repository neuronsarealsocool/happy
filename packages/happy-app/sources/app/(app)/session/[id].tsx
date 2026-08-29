import * as React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SessionView } from '@/-session/SessionView';
import { storage } from '@/sync/storage';
import { drainAndroidChatHeadReplies } from '@/utils/androidChatHeadReplyTask';


export default React.memo(() => {
    const params = useLocalSearchParams<{
        id?: string;
        chatHeadDraft?: string;
        chatHeadSend?: string;
        chatHeadNonce?: string;
    }>();
    const sessionId = params.id as string;
    const handledChatHeadDraftRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        const draft = typeof params.chatHeadDraft === 'string' ? params.chatHeadDraft : '';
        if (!sessionId || !draft.trim()) {
            return;
        }
        const dedupeKey = `${sessionId}:${params.chatHeadSend ?? '0'}:${params.chatHeadNonce ?? ''}:${draft}`;
        if (handledChatHeadDraftRef.current === dedupeKey) {
            return;
        }
        handledChatHeadDraftRef.current = dedupeKey;

        if (params.chatHeadSend === '1') {
            void drainAndroidChatHeadReplies(sessionId);
            return;
        }

        storage.getState().updateSessionDraft(sessionId, draft);
    }, [params.chatHeadDraft, params.chatHeadNonce, params.chatHeadSend, sessionId]);

    return (<SessionView id={sessionId} />);
});
