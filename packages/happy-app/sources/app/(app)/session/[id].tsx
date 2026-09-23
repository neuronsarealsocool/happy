import * as React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SessionView } from '@/-session/SessionView';
import { storage } from '@/sync/storage';
import { sync } from '@/sync/sync';
import { consumeAndroidChatHeadPendingReplies } from '@/utils/androidChatHeads';


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
            void consumeAndroidChatHeadPendingReplies(sessionId).then((pendingReplies) => {
                for (const reply of pendingReplies) {
                    void sync.sendMessage(sessionId, reply.text, { source: 'chat' });
                }
            });
            return;
        }

        storage.getState().updateSessionDraft(sessionId, draft);
    }, [params.chatHeadDraft, params.chatHeadNonce, params.chatHeadSend, sessionId]);

    // The web session route is singular (see useNavigateToSession): a hop to
    // another session reuses the route key and only swaps params, so key the
    // view on the id to remount the session-local state.
    return (<SessionView key={sessionId} id={sessionId} />);
});
