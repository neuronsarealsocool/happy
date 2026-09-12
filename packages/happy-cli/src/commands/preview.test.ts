import { describe, expect, it } from 'vitest';
import { buildExpoPreviewArgs, buildExpoRunner, getExpoPreviewPort, selectExpoTunnelUrl } from './preview';

describe('buildExpoPreviewArgs', () => {
    it('starts Expo Web with a tunnel by default', () => {
        expect(buildExpoPreviewArgs([])).toEqual(['expo', 'start', '--web', '--tunnel']);
    });

    it('forwards Expo options', () => {
        expect(buildExpoPreviewArgs(['--port', '8082', '--clear'])).toEqual([
            'expo',
            'start',
            '--web',
            '--tunnel',
            '--port',
            '8082',
            '--clear',
        ]);
    });

    it('does not duplicate required flags', () => {
        expect(buildExpoPreviewArgs(['--web', '--tunnel', '--clear'])).toEqual([
            'expo',
            'start',
            '--web',
            '--tunnel',
            '--clear',
        ]);
    });
});

describe('getExpoPreviewPort', () => {
    it('reads either Expo port syntax', () => {
        expect(getExpoPreviewPort(['--port', '8092'])).toBe(8092);
        expect(getExpoPreviewPort(['--port=8093'])).toBe(8093);
        expect(getExpoPreviewPort([])).toBe(8081);
    });
});

describe('selectExpoTunnelUrl', () => {
    it('selects the HTTPS tunnel forwarding the Expo web port', () => {
        expect(selectExpoTunnelUrl({
            tunnels: [
                { public_url: 'https://other.exp.direct', config: { addr: 'http://localhost:8081' } },
                { public_url: 'http://demo.exp.direct', config: { addr: 'http://localhost:8092' } },
                { public_url: 'https://demo.exp.direct', config: { addr: 'http://localhost:8092' } },
            ],
        }, 8092)).toBe('https://demo.exp.direct');
    });
});

describe('buildExpoRunner', () => {
    it('uses the project package manager with Windows shims', () => {
        expect(buildExpoRunner('pnpm', 'win32')).toEqual({ command: 'pnpm.cmd', prefix: ['exec'] });
        expect(buildExpoRunner('npm', 'linux')).toEqual({ command: 'npx', prefix: [] });
    });
});
