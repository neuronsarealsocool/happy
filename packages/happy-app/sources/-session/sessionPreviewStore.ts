import { Platform } from 'react-native';
import { create } from 'zustand';
import { createExplicitPreviewTarget, type SessionPreviewTarget, type SessionPreviewTargetKind } from '@/utils/sessionPreviewTargets';

export type RightPaneMode = 'preview' | 'files';

type SessionPreviewState = {
    target: SessionPreviewTarget | null;
    mode: RightPaneMode;
    isOpen: boolean;
    suppressedTargetId: string | null;
    width: number | null;
    refreshSignal: number;
};

type SessionPreviewStore = {
    sessions: Record<string, SessionPreviewState>;
    registerDetectedPreview: (sessionId: string, target: SessionPreviewTarget | null) => void;
    registerExplicitPreview: (sessionId: string, input: {
        uri: string;
        title?: string | null;
        kind?: SessionPreviewTargetKind;
        createdAt?: number;
    }) => void;
    setMode: (sessionId: string, mode: RightPaneMode) => void;
    openPane: (sessionId: string, mode?: RightPaneMode) => void;
    togglePreviewTarget: (sessionId: string, target: SessionPreviewTarget | null) => void;
    collapsePane: (sessionId: string) => void;
    setWidth: (sessionId: string, width: number) => void;
};

const defaultState: SessionPreviewState = {
    target: null,
    mode: 'files',
    isOpen: false,
    suppressedTargetId: null,
    width: null,
    refreshSignal: 0,
};
const STORAGE_KEY = 'happy-session-preview-v3';

function getSessionState(state: SessionPreviewStore, sessionId: string): SessionPreviewState {
    const current = state.sessions[sessionId];
    return current ? { ...defaultState, ...current } : defaultState;
}

function loadPersistedSessions(): Record<string, SessionPreviewState> {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return {};

    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return {};
        const parsed = JSON.parse(stored) as { sessions?: Record<string, SessionPreviewState> };
        const sessions = parsed.sessions ?? {};
        return Object.fromEntries(
            Object.entries(sessions).map(([sessionId, state]) => [
                sessionId,
                {
                    ...defaultState,
                    ...state,
                    isOpen: false,
                    suppressedTargetId: state.target?.id ?? state.suppressedTargetId ?? null,
                    refreshSignal: 0,
                },
            ]),
        );
    } catch {
        return {};
    }
}

function savePersistedSessions(sessions: Record<string, SessionPreviewState>) {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions }));
    } catch {
        // Preview memory is a convenience; ignore storage quota/privacy failures.
    }
}

export const useSessionPreviewStore = create<SessionPreviewStore>((set) => ({
    sessions: loadPersistedSessions(),
    registerDetectedPreview: (sessionId, target) => {
        if (!target) return;
        set((state) => {
            const current = getSessionState(state, sessionId);
            if (current.target?.id === target.id) return state;
            const sessions = {
                ...state.sessions,
                [sessionId]: {
                    ...current,
                    target,
                    mode: 'preview' as const,
                    isOpen: false,
                    suppressedTargetId: target.id,
                },
            };
            savePersistedSessions(sessions);
            return { sessions };
        });
    },
    registerExplicitPreview: (sessionId, input) => {
        const target = createExplicitPreviewTarget(input);
        set((state) => {
            const current = getSessionState(state, sessionId);
            const sessions = {
                ...state.sessions,
                [sessionId]: {
                    ...current,
                    target,
                    mode: 'preview' as const,
                    isOpen: true,
                    suppressedTargetId: current.suppressedTargetId === target.id ? null : current.suppressedTargetId,
                    refreshSignal: current.refreshSignal + 1,
                },
            };
            savePersistedSessions(sessions);
            return { sessions };
        });
    },
    setMode: (sessionId, mode) => {
        set((state) => {
            const current = getSessionState(state, sessionId);
            const sessions = {
                ...state.sessions,
                [sessionId]: { ...current, mode, isOpen: true },
            };
            savePersistedSessions(sessions);
            return { sessions };
        });
    },
    openPane: (sessionId, mode) => {
        set((state) => {
            const current = getSessionState(state, sessionId);
            const sessions = {
                ...state.sessions,
                [sessionId]: {
                    ...current,
                    mode: mode ?? current.mode,
                    isOpen: true,
                    suppressedTargetId: null,
                },
            };
            savePersistedSessions(sessions);
            return { sessions };
        });
    },
    togglePreviewTarget: (sessionId, target) => {
        set((state) => {
            const current = getSessionState(state, sessionId);
            if (!target) {
                if (!current.isOpen || current.mode !== 'preview') return state;
                const sessions = {
                    ...state.sessions,
                    [sessionId]: {
                        ...current,
                        isOpen: false,
                        suppressedTargetId: current.target?.id ?? current.suppressedTargetId,
                    },
                };
                savePersistedSessions(sessions);
                return { sessions };
            }

            const isShowingTarget = current.isOpen && current.mode === 'preview' && current.target?.id === target.id;
            const sessions = {
                ...state.sessions,
                [sessionId]: isShowingTarget
                    ? {
                        ...current,
                        isOpen: false,
                        suppressedTargetId: target.id,
                    }
                    : {
                        ...current,
                        target,
                        mode: 'preview' as const,
                        isOpen: true,
                        suppressedTargetId: null,
                        refreshSignal: current.refreshSignal + 1,
                    },
            };
            savePersistedSessions(sessions);
            return { sessions };
        });
    },
    collapsePane: (sessionId) => {
        set((state) => {
            const current = getSessionState(state, sessionId);
            const sessions = {
                ...state.sessions,
                [sessionId]: {
                    ...current,
                    isOpen: false,
                    suppressedTargetId: current.target?.id ?? current.suppressedTargetId,
                },
            };
            savePersistedSessions(sessions);
            return { sessions };
        });
    },
    setWidth: (sessionId, width) => {
        set((state) => {
            const current = getSessionState(state, sessionId);
            const sessions = {
                ...state.sessions,
                [sessionId]: { ...current, width },
            };
            savePersistedSessions(sessions);
            return { sessions };
        });
    },
}));

export function registerSessionPreview(sessionId: string, input: {
    uri: string;
    title?: string | null;
    kind?: SessionPreviewTargetKind;
    createdAt?: number;
}) {
    useSessionPreviewStore.getState().registerExplicitPreview(sessionId, input);
}
