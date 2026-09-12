import { describe, expect, it } from 'vitest';
import { canEmbedSessionPreviewUrl, discoverPreviewTargetInText, discoverPreviewTargetsInText, discoverSessionPreviewTarget } from './sessionPreviewTargets';
import type { Message } from '@/sync/typesMessage';

describe('session preview targets', () => {
    it('detects here.now deployment links', () => {
        expect(discoverPreviewTargetInText('Deployed here: https://queued-tablet-2f9v.here.now/')).toMatchObject({
            kind: 'url',
            uri: 'https://queued-tablet-2f9v.here.now/',
        });
    });

    it('detects localhost development URLs', () => {
        expect(discoverPreviewTargetInText('Running at http://localhost:5173')).toMatchObject({
            kind: 'url',
            uri: 'http://localhost:5173',
        });
    });

    it('marks Expo development URLs for a mobile viewport', () => {
        expect(discoverPreviewTargetInText('Expo web is running at http://localhost:8081')).toMatchObject({
            kind: 'url',
            uri: 'http://localhost:8081',
            preferredViewport: 'mobile',
        });
    });

    it('detects Expo HTTPS tunnels as mobile previews', () => {
        expect(discoverPreviewTargetInText('Expo Web is running at https://quiet-river.bacon.19000.exp.direct')).toMatchObject({
            kind: 'url',
            uri: 'https://quiet-river.bacon.19000.exp.direct',
            preferredViewport: 'mobile',
        });
    });

    it('prefers an Expo HTTPS tunnel over localhost output', () => {
        expect(discoverPreviewTargetInText([
            'Expo Web public mobile preview: https://quiet-river.bacon.19000.exp.direct',
            'Waiting on http://localhost:8081',
        ].join('\n'))).toMatchObject({
            uri: 'https://quiet-river.bacon.19000.exp.direct',
            preferredViewport: 'mobile',
        });
    });

    it('embeds loopback, same-origin, and Expo tunnel previews only', () => {
        expect(canEmbedSessionPreviewUrl('http://localhost:8081')).toBe(true);
        expect(canEmbedSessionPreviewUrl('https://quiet-river.bacon.19000.exp.direct')).toBe(true);
        expect(canEmbedSessionPreviewUrl('https://happy.example/preview', 'https://happy.example')).toBe(true);
        expect(canEmbedSessionPreviewUrl('https://example.com')).toBe(false);
        expect(canEmbedSessionPreviewUrl('not a url')).toBe(false);
    });

    it('leaves ordinary web development URLs responsive', () => {
        expect(discoverPreviewTargetInText('Vite is running at http://localhost:5173')).not.toHaveProperty('preferredViewport');
    });

    it('detects previewable local artifacts', () => {
        expect(discoverPreviewTargetInText('Created C:\\Users\\matt\\site\\index.html')).toMatchObject({
            kind: 'file',
            uri: 'C:/Users/matt/site/index.html',
        });
    });

    it('detects bare generated PDF names', () => {
        expect(discoverPreviewTargetInText('Done, I created car.pdf for you.')).toMatchObject({
            kind: 'file',
            uri: 'car.pdf',
        });
    });

    it('normalizes files under the session project path', () => {
        expect(discoverPreviewTargetInText(
            'Created D:\\Users\\Matt\\project\\outputs\\demo.pdf',
            { projectPath: 'D:\\Users\\Matt\\project' },
        )).toMatchObject({
            kind: 'file',
            uri: 'D:/Users/Matt/project/outputs/demo.pdf',
        });
    });

    it('resolves relative artifacts against the session project path', () => {
        expect(discoverPreviewTargetInText(
            'Done, I created reports/demo.pdf.',
            { projectPath: 'D:\\Users\\Matt\\project' },
        )).toMatchObject({
            kind: 'file',
            uri: 'D:/Users/Matt/project/reports/demo.pdf',
        });
    });

    it('maps absolute artifact paths outside the session back into the session project path', () => {
        expect(discoverPreviewTargetInText(
            'Created C:\\Users\\matt\\park_the_car_in_image_1_on_the.png',
            { projectPath: 'D:\\Users\\Matt\\project' },
        )).toMatchObject({
            kind: 'file',
            uri: 'D:/Users/Matt/project/park_the_car_in_image_1_on_the.png',
            title: 'park_the_car_in_image_1_on_the.png',
        });
    });

    it('returns multiple previewable artifacts for explicit artifact actions', () => {
        expect(discoverPreviewTargetsInText(
            'Created report.pdf and chart.png.',
            { projectPath: 'D:\\Users\\Matt\\project' },
        )).toEqual([
            {
                kind: 'file',
                uri: 'D:/Users/Matt/project/report.pdf',
                title: 'report.pdf',
            },
            {
                kind: 'file',
                uri: 'D:/Users/Matt/project/chart.png',
                title: 'chart.png',
            },
        ]);
    });

    it('ignores ordinary links without preview context', () => {
        expect(discoverPreviewTargetInText('Docs are at https://github.com/neuronsarealsocool/happy')).toBeNull();
    });

    it('ignores ordinary README mentions without artifact context', () => {
        expect(discoverPreviewTargetInText(
            'Open README.md for setup notes.',
            { projectPath: 'D:\\Users\\Matt\\project' },
        )).toBeNull();
    });

    it('allows ordinary links with explicit preview context', () => {
        expect(discoverPreviewTargetInText('Preview: https://example.com/build')).toMatchObject({
            kind: 'url',
            uri: 'https://example.com/build',
        });
    });

    it('uses the newest previewable assistant message', () => {
        const messages: Message[] = [
            {
                kind: 'agent-text',
                id: 'old',
                localId: null,
                createdAt: 1,
                text: 'Deployed here: https://first.here.now/',
            },
            {
                kind: 'agent-text',
                id: 'new',
                localId: null,
                createdAt: 2,
                text: 'Deployed here: https://second.here.now/',
            },
        ];

        expect(discoverSessionPreviewTarget(messages)).toMatchObject({
            id: 'new:url:https://second.here.now/',
            uri: 'https://second.here.now/',
        });
    });

    it('uses the newest previewable assistant message when storage is newest-first', () => {
        const messages: Message[] = [
            {
                kind: 'agent-text',
                id: 'new',
                localId: null,
                createdAt: 2,
                text: 'Deployed here: https://second.here.now/',
            },
            {
                kind: 'agent-text',
                id: 'old',
                localId: null,
                createdAt: 1,
                text: 'Deployed here: https://first.here.now/',
            },
        ];

        expect(discoverSessionPreviewTarget(messages)).toMatchObject({
            id: 'new:url:https://second.here.now/',
            uri: 'https://second.here.now/',
        });
    });
});
