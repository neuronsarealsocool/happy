import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
    Platform: { OS: 'web' },
}));

function installLocalStorage(initial?: Record<string, string>) {
    const store = new Map(Object.entries(initial ?? {}));
    (globalThis as any).window = {
        localStorage: {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => { store.set(key, value); },
            removeItem: (key: string) => { store.delete(key); },
            clear: () => { store.clear(); },
        },
    };
    return store;
}

async function loadStore() {
    vi.resetModules();
    return await import('./sessionPreviewStore');
}

describe('sessionPreviewStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        installLocalStorage();
    });

    it('keeps detected previews collapsed by default', async () => {
        const { useSessionPreviewStore } = await loadStore();

        useSessionPreviewStore.getState().registerDetectedPreview('session-1', {
            id: 'agent:url:https://example.here.now/',
            kind: 'url',
            uri: 'https://example.here.now/',
            title: 'example.here.now',
            source: 'detected',
            createdAt: 1,
        });

        expect(useSessionPreviewStore.getState().sessions['session-1']).toMatchObject({
            mode: 'preview',
            isOpen: false,
            suppressedTargetId: 'agent:url:https://example.here.now/',
        });
    });

    it('opens the pane for explicit artifact previews', async () => {
        const { useSessionPreviewStore } = await loadStore();

        useSessionPreviewStore.getState().registerExplicitPreview('session-1', {
            uri: 'D:/project/report.pdf',
            title: 'report.pdf',
            kind: 'file',
        });

        expect(useSessionPreviewStore.getState().sessions['session-1']).toMatchObject({
            mode: 'preview',
            isOpen: true,
            target: {
                kind: 'file',
                uri: 'D:/project/report.pdf',
                title: 'report.pdf',
            },
        });
        expect(useSessionPreviewStore.getState().sessions['session-1']?.refreshSignal).toBe(1);
    });

    it('toggles the latest preview and refreshes when opening', async () => {
        const { useSessionPreviewStore } = await loadStore();
        const target = {
            id: 'agent:file:report.pdf',
            kind: 'file' as const,
            uri: 'D:/project/report.pdf',
            title: 'report.pdf',
            source: 'detected' as const,
            createdAt: 1,
        };

        useSessionPreviewStore.getState().togglePreviewTarget('session-1', target);

        expect(useSessionPreviewStore.getState().sessions['session-1']).toMatchObject({
            mode: 'preview',
            isOpen: true,
            target,
            refreshSignal: 1,
        });

        useSessionPreviewStore.getState().togglePreviewTarget('session-1', target);

        expect(useSessionPreviewStore.getState().sessions['session-1']).toMatchObject({
            mode: 'preview',
            isOpen: false,
            target,
            refreshSignal: 1,
        });
    });

    it('loads persisted pane state collapsed', async () => {
        installLocalStorage({
            'happy-session-preview-v3': JSON.stringify({
                sessions: {
                    'session-1': {
                        target: {
                            id: 'agent:file:report.pdf',
                            kind: 'file',
                            uri: 'report.pdf',
                            title: 'report.pdf',
                            source: 'detected',
                            createdAt: 1,
                        },
                        mode: 'preview',
                        isOpen: true,
                        suppressedTargetId: null,
                        width: 420,
                    },
                },
            }),
        });

        const { useSessionPreviewStore } = await loadStore();

        expect(useSessionPreviewStore.getState().sessions['session-1']).toMatchObject({
            mode: 'preview',
            isOpen: false,
            suppressedTargetId: 'agent:file:report.pdf',
            width: 420,
        });
    });
});
