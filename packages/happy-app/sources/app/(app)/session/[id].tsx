import * as React from 'react';
import { useRoute } from "@react-navigation/native";
import { SessionView } from '@/-session/SessionView';
import { storage } from '@/sync/storage';
import { sync } from '@/sync/sync';


export default React.memo(() => {
    const route = useRoute();
    const params = route.params! as any;
    const sessionId = params.id as string;
    const handledChatHeadDraftRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        const draft = typeof params.chatHeadDraft === 'string' ? params.chatHeadDraft : '';
        if (!sessionId || !draft.trim()) {
            return;
        }
        const dedupeKey = `${sessionId}:${params.chatHeadSend ?? '0'}:${draft}`;
        if (handledChatHeadDraftRef.current === dedupeKey) {
            return;
        }
        handledChatHeadDraftRef.current = dedupeKey;

        if (params.chatHeadSend === '1') {
            storage.getState().updateSessionDraft(sessionId, null);
            void sync.sendMessage(sessionId, draft, { source: 'chat' });
            return;
        }

        storage.getState().updateSessionDraft(sessionId, draft);
    }, [params.chatHeadDraft, params.chatHeadSend, sessionId]);

    return (<SessionView id={sessionId} />);
});
