import type { Message } from '@/sync/typesMessage';

export type SessionPreviewTargetKind = 'url' | 'file';

export type SessionPreviewTarget = {
    id: string;
    kind: SessionPreviewTargetKind;
    uri: string;
    title: string;
    source: 'detected' | 'explicit';
    createdAt: number;
};

type PreviewCandidate = Omit<SessionPreviewTarget, 'id' | 'source' | 'createdAt'>;

const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;
const FILE_URL_RE = /\bfile:\/\/\/[^\s<>"'`)\]]+/gi;
const WINDOWS_PATH_RE = /(?:[A-Za-z]:[\\/][^\s<>"'`|]+?\.(?:html?|png|jpe?g|gif|webp|svg|pdf|md))/gi;
const POSIX_PATH_RE = /(?:~?\/[^\s<>"'`|]+?\.(?:html?|png|jpe?g|gif|webp|svg|pdf|md))/gi;
const RELATIVE_PATH_RE = /(?:\.{1,2}[\\/])?[A-Za-z0-9_.@()[\]\-]+(?:[\\/][A-Za-z0-9_.@()[\]\-]+)*\.(?:html?|png|jpe?g|gif|webp|svg|pdf|md)\b/gi;
const PREVIEW_WORD_RE = /\b(preview|deployed|deployment|live|website|site|app|open|hosted|published|available|served|running)\b/i;
const ARTIFACT_WORD_RE = /\b(created|generated|wrote|saved|exported|rendered|built|made|artifact|file|pdf|image|download)\b/i;

const PREVIEW_EXT_RE = /\.(?:html?|png|jpe?g|gif|webp|svg|pdf|md)(?:[?#].*)?$/i;

export function discoverSessionPreviewTarget(messages: Message[], options?: { projectPath?: string | null }): SessionPreviewTarget | null {
    let latest: SessionPreviewTarget | null = null;

    for (const message of messages) {
        if (message.kind !== 'agent-text' && message.kind !== 'tool-call') {
            continue;
        }

        const text = getPreviewSearchText(message);
        if (!text) continue;

        const candidate = discoverPreviewTargetInText(text, options);
        if (!candidate) continue;

        const target = {
            ...candidate,
            id: `${message.id}:${candidate.kind}:${candidate.uri}`,
            source: 'detected' as const,
            createdAt: message.createdAt,
        };
        if (!latest || target.createdAt > latest.createdAt) {
            latest = target;
        }
    }

    return latest;
}

export function discoverPreviewTargetInText(text: string, options?: { projectPath?: string | null }): PreviewCandidate | null {
    return discoverPreviewTargetsInText(text, options, 1)[0] ?? null;
}

export function discoverPreviewTargetsInText(text: string, options?: { projectPath?: string | null }, limit = 6): PreviewCandidate[] {
    const targets: PreviewCandidate[] = [];
    const seen = new Set<string>();

    const addTarget = (target: PreviewCandidate) => {
        const key = `${target.kind}:${target.uri}`;
        if (seen.has(key)) return;
        seen.add(key);
        targets.push(target);
    };

    const urlCandidates = collectMatches(text, URL_RE)
        .concat(collectMatches(text, FILE_URL_RE))
        .map((raw) => normalizeTrailingPunctuation(raw));

    for (let i = urlCandidates.length - 1; i >= 0; i--) {
        const uri = urlCandidates[i];
        if (isLikelyPreviewUrl(uri, text)) {
            addTarget({
                kind: uri.startsWith('file://') ? 'file' : 'url',
                uri,
                title: titleForUri(uri),
            });
            if (targets.length >= limit) return targets;
        }
    }

    const fileCandidates = collectMatches(text, RELATIVE_PATH_RE)
        .concat(collectMatches(text, POSIX_PATH_RE))
        .concat(collectMatches(text, WINDOWS_PATH_RE))
        .map((raw) => normalizeTrailingPunctuation(raw))
        .sort((a, b) => a.length - b.length);

    for (let i = fileCandidates.length - 1; i >= 0; i--) {
        const uri = normalizeSessionFilePath(fileCandidates[i], options?.projectPath);
        if (isLikelyPreviewFile(uri, text)) {
            addTarget({
                kind: 'file',
                uri,
                title: titleForUri(uri),
            });
            if (targets.length >= limit) return targets;
        }
    }

    return targets;
}

export function createExplicitPreviewTarget(input: {
    uri: string;
    title?: string | null;
    kind?: SessionPreviewTargetKind;
    createdAt?: number;
}): SessionPreviewTarget {
    const uri = normalizeTrailingPunctuation(input.uri.trim());
    const kind = input.kind ?? (uri.startsWith('http://') || uri.startsWith('https://') ? 'url' : 'file');
    return {
        id: `explicit:${kind}:${uri}`,
        kind,
        uri,
        title: input.title?.trim() || titleForUri(uri),
        source: 'explicit',
        createdAt: input.createdAt ?? Date.now(),
    };
}

function getPreviewSearchText(message: Message): string {
    if (message.kind === 'agent-text') {
        return message.text;
    }
    if (message.kind !== 'tool-call') {
        return '';
    }

    const parts: string[] = [];
    if (message.tool.description) parts.push(message.tool.description);
    collectStructuredPreviewHints(message.tool.input, parts);
    collectText(message.tool.input, parts);
    collectText(message.tool.result, parts);
    for (const child of message.children) {
        parts.push(getPreviewSearchText(child));
    }
    return parts.join('\n');
}

function collectStructuredPreviewHints(value: unknown, parts: string[]) {
    if (!value || typeof value !== 'object') return;
    const input = value as Record<string, unknown>;
    const parsed = input.parsed_cmd;
    if (Array.isArray(parsed)) {
        for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const command = item as Record<string, unknown>;
            if (typeof command.name === 'string') parts.push(command.name);
            if (typeof command.path === 'string') parts.push(command.path);
            if (typeof command.file_path === 'string') parts.push(command.file_path);
        }
    }
    for (const key of ['path', 'file_path', 'filename', 'name', 'output', 'output_path', 'url', 'uri']) {
        const item = input[key];
        if (typeof item === 'string') parts.push(item);
    }
}

function collectText(value: unknown, parts: string[]) {
    if (typeof value === 'string') {
        parts.push(value);
        return;
    }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        for (const item of value) collectText(item, parts);
        return;
    }
    for (const item of Object.values(value as Record<string, unknown>)) {
        collectText(item, parts);
    }
}

function isLikelyPreviewUrl(rawUri: string, surroundingText: string): boolean {
    try {
        const uri = new URL(rawUri);
        const hostname = uri.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return true;
        if (hostname.endsWith('.localhost')) return true;
        if (hostname === 'here.now' || hostname.endsWith('.here.now')) return true;
        if (hostname.includes('vercel.app') || hostname.includes('netlify.app') || hostname.includes('pages.dev')) return true;
        if (PREVIEW_EXT_RE.test(uri.pathname)) return true;
        return PREVIEW_WORD_RE.test(surroundingText);
    } catch {
        return rawUri.startsWith('file://') && PREVIEW_EXT_RE.test(rawUri);
    }
}

function isLikelyPreviewFile(uri: string, surroundingText: string): boolean {
    if (!PREVIEW_EXT_RE.test(uri)) return false;
    if (!uri.toLowerCase().endsWith('.md')) return true;
    return ARTIFACT_WORD_RE.test(surroundingText);
}

function collectMatches(text: string, regex: RegExp): string[] {
    regex.lastIndex = 0;
    return Array.from(text.matchAll(regex), (match) => match[0]);
}

function normalizeTrailingPunctuation(value: string): string {
    return value.replace(/[.,;:!?]+$/g, '').replace(/^['"`([{]+|['"`)\]}]+$/g, '');
}

function titleForUri(uri: string): string {
    if (isAbsolutePath(uri.replaceAll('\\', '/'))) {
        const parts = uri.split(/[\\/]/).filter(Boolean);
        return parts[parts.length - 1] ?? uri;
    }

    try {
        const url = new URL(uri);
        return url.hostname || uri;
    } catch {
        const parts = uri.split(/[\\/]/).filter(Boolean);
        return parts[parts.length - 1] ?? uri;
    }
}

function normalizeSessionFilePath(path: string, projectPath?: string | null): string {
    let out = path.trim();
    if (!/[\\/]/.test(out) && /\s/.test(out)) {
        const fileName = out.match(/[A-Za-z0-9_.@()[\]-]+\.(?:html?|png|jpe?g|gif|webp|svg|pdf|md)$/i)?.[0];
        if (fileName) out = fileName;
    }
    if (out.startsWith('file:///')) {
        out = decodeURIComponent(out.slice('file:///'.length));
    }

    const normalizedPath = out.replaceAll('\\', '/');
    if (projectPath) {
        const normalizedRoot = projectPath.replaceAll('\\', '/').replace(/\/+$/, '');
        if (normalizedPath.toLowerCase().startsWith(normalizedRoot.toLowerCase() + '/')) {
            return normalizedPath;
        }
        if (!isAbsolutePath(normalizedPath)) {
            const relative = normalizedPath.replace(/^\.?[\\/]/, '');
            return `${normalizedRoot}/${relative}`;
        }
        const fileName = basenameFromPath(normalizedPath);
        return fileName ? `${normalizedRoot}/${fileName}` : normalizedPath;
    }

    return normalizedPath.replace(/^\.?[\\/]/, '');
}

function isAbsolutePath(path: string): boolean {
    return /^[A-Za-z]:\//.test(path) || path.startsWith('/');
}

function basenameFromPath(path: string): string | null {
    const parts = path.split(/[\\/]/).filter(Boolean);
    return parts[parts.length - 1] ?? null;
}
