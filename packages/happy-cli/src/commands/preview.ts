import chalk from 'chalk';
import spawn from 'cross-spawn';
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

const DEFAULT_EXPO_PORT = 8081;
const NGROK_API_URL = 'http://127.0.0.1:4040/api/tunnels';

type NgrokTunnel = {
    public_url?: unknown;
    config?: { addr?: unknown };
};

type ExpoPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export function buildExpoPreviewArgs(args: string[]): string[] {
    const forwarded = args.filter((arg) => arg !== '--web' && arg !== '--tunnel');
    return ['expo', 'start', '--web', '--tunnel', ...forwarded];
}

export function getExpoPreviewPort(args: string[]): number {
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        const value = arg === '--port' ? args[index + 1] : arg.startsWith('--port=') ? arg.slice('--port='.length) : null;
        if (value && /^\d+$/.test(value)) return Number(value);
    }
    return DEFAULT_EXPO_PORT;
}

export function selectExpoTunnelUrl(value: unknown, port: number): string | null {
    if (!value || typeof value !== 'object' || !Array.isArray((value as { tunnels?: unknown }).tunnels)) return null;

    for (const tunnel of (value as { tunnels: NgrokTunnel[] }).tunnels) {
        if (typeof tunnel.public_url !== 'string' || !tunnel.public_url.startsWith('https://')) continue;
        if (typeof tunnel.config?.addr !== 'string') continue;
        try {
            if (new URL(tunnel.config.addr).port === String(port)) return tunnel.public_url;
        } catch {
            // Ignore unrelated malformed ngrok entries.
        }
    }
    return null;
}

export function findExpoPackageManager(cwd: string): ExpoPackageManager {
    let directory = cwd;
    while (true) {
        if (existsSync(join(directory, 'pnpm-lock.yaml'))) return 'pnpm';
        if (existsSync(join(directory, 'yarn.lock'))) return 'yarn';
        if (existsSync(join(directory, 'bun.lock')) || existsSync(join(directory, 'bun.lockb'))) return 'bun';
        if (existsSync(join(directory, 'package-lock.json'))) return 'npm';
        const parent = dirname(directory);
        if (parent === directory || directory === parse(directory).root) return 'npm';
        directory = parent;
    }
}

export function buildExpoRunner(packageManager: ExpoPackageManager, platform = process.platform): { command: string; prefix: string[] } {
    const windowsSuffix = platform === 'win32' ? '.cmd' : '';
    switch (packageManager) {
        case 'pnpm': return { command: `pnpm${windowsSuffix}`, prefix: ['exec'] };
        case 'yarn': return { command: `yarn${windowsSuffix}`, prefix: [] };
        case 'bun': return { command: `bunx${windowsSuffix}`, prefix: [] };
        default: return { command: `npx${windowsSuffix}`, prefix: [] };
    }
}

async function announceExpoTunnelUrl(port: number, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
        try {
            const response = await fetch(NGROK_API_URL, { signal });
            if (response.ok) {
                const publicUrl = selectExpoTunnelUrl(await response.json(), port);
                if (publicUrl) {
                    console.log(chalk.green(`Expo Web public mobile preview: ${publicUrl}`));
                    return;
                }
            }
        } catch (error) {
            if (signal.aborted) return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 750));
    }
}

export async function handlePreviewCommand(args: string[]): Promise<void> {
    if (args.some((arg) => arg === '--help' || arg === '-h')) {
        console.log(`
${chalk.bold('happy preview')} - Start an Expo Web preview through an HTTPS tunnel

${chalk.bold('Usage:')}
  happy preview [expo options]

${chalk.bold('Examples:')}
  happy preview
  happy preview --port 8082

The tunnel URL is public while this command is running. Treat it as a shared secret.
`);
        return;
    }

    const runner = buildExpoRunner(findExpoPackageManager(process.cwd()));
    const expoArgs = buildExpoPreviewArgs(args);
    const port = getExpoPreviewPort(args);
    const tunnelAbortController = new AbortController();

    console.log(chalk.cyan('Starting Expo Web with a remote HTTPS preview...'));
    console.log(chalk.gray('Happy will detect the tunnel URL when this runs inside a coding session.'));
    console.log(chalk.yellow('The temporary tunnel URL is public. Share it only with people you trust.'));

    const childPromise = new Promise<void>((resolve, reject) => {
        const child = spawn(runner.command, [...runner.prefix, ...expoArgs], {
            cwd: process.cwd(),
            env: process.env,
            stdio: 'inherit',
            windowsHide: true,
        });

        child.once('error', (error) => {
            tunnelAbortController.abort();
            reject(new Error(`Could not start Expo: ${error.message}`));
        });
        child.once('exit', (code, signal) => {
            tunnelAbortController.abort();
            if (signal === 'SIGINT' || code === 0) {
                resolve();
                return;
            }
            reject(new Error(`Expo preview exited with ${signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`}.`));
        });
    });

    void announceExpoTunnelUrl(port, tunnelAbortController.signal);
    await childPromise;
}
