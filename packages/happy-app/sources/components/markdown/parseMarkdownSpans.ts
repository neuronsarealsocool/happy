import type { MarkdownSpan } from "./parseMarkdown";

// Updated pattern to handle nested markdown and asterisks
const pattern = /(\*\*(.*?)(?:\*\*|$))|(\*(.*?)(?:\*|$))|(\[([^\]]+)\](?:\(([^)]+)\))?)|(`(.*?)(?:`|$))/g;
const artifactPattern = /(?:[A-Za-z]:[\\/][^\s<>"'`|]+?\.(?:html?|png|jpe?g|gif|webp|svg|pdf|md)|(?:\.{1,2}[\\/])?[A-Za-z0-9_.@()[\]\-]+(?:[\\/][A-Za-z0-9_.@()[\]\-]+)*\.(?:html?|png|jpe?g|gif|webp|svg|pdf|md))\b/gi;

function pushPlainTextWithArtifactLinks(spans: MarkdownSpan[], text: string, styles: MarkdownSpan['styles']) {
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    artifactPattern.lastIndex = 0;

    while ((match = artifactPattern.exec(text)) !== null) {
        const plainText = text.slice(lastIndex, match.index);
        if (plainText) {
            spans.push({ styles, text: plainText, url: null });
        }

        let artifact = match[0];
        let trailing = '';
        while (/[),.;:!?]$/.test(artifact)) {
            trailing = artifact.slice(-1) + trailing;
            artifact = artifact.slice(0, -1);
        }

        if (artifact) {
            spans.push({ styles, text: artifact, url: `artifact://${encodeURIComponent(artifact)}` });
        }
        if (trailing) {
            spans.push({ styles, text: trailing, url: null });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        spans.push({ styles, text: text.slice(lastIndex), url: null });
    }
}

function pushTextWithAutoLinks(spans: MarkdownSpan[], text: string, styles: MarkdownSpan['styles']) {
    const urlPattern = /https?:\/\/[^\s<]+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = urlPattern.exec(text)) !== null) {
        const plainText = text.slice(lastIndex, match.index);
        if (plainText) {
            pushPlainTextWithArtifactLinks(spans, plainText, styles);
        }

        let url = match[0];
        let trailing = '';
        while (/[),.;:!?]$/.test(url)) {
            trailing = url.slice(-1) + trailing;
            url = url.slice(0, -1);
        }

        if (url) {
            spans.push({ styles, text: url, url });
        }
        if (trailing) {
            spans.push({ styles, text: trailing, url: null });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        pushPlainTextWithArtifactLinks(spans, text.slice(lastIndex), styles);
    }
}

function artifactUrlForExactText(text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) {
        return null;
    }

    artifactPattern.lastIndex = 0;
    const match = artifactPattern.exec(trimmed);
    artifactPattern.lastIndex = 0;

    if (match?.[0] === trimmed) {
        return `artifact://${encodeURIComponent(trimmed)}`;
    }

    return null;
}

export function parseMarkdownSpans(markdown: string, header: boolean) {
    const spans: MarkdownSpan[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;

    while ((match = pattern.exec(markdown)) !== null) {
        // Capture the text between the end of the last match and the start of this match as plain text
        const plainText = markdown.slice(lastIndex, match.index);
        if (plainText) {
            pushTextWithAutoLinks(spans, plainText, []);
        }

        if (match[1]) {
            // Bold
            if (header) {
                pushTextWithAutoLinks(spans, match[2], []);
            } else {
                pushTextWithAutoLinks(spans, match[2], ['bold']);
            }
        } else if (match[3]) {
            // Italic
            if (header) {
                pushTextWithAutoLinks(spans, match[4], []);
            } else {
                pushTextWithAutoLinks(spans, match[4], ['italic']);
            }
        } else if (match[5]) {
            // Link - handle incomplete links (no URL part)
            if (match[7]) {
                spans.push({ styles: [], text: match[6], url: match[7] });
            } else {
                // If no URL part, treat as plain text with brackets
                pushTextWithAutoLinks(spans, `[${match[6]}]`, []);
            }
        } else if (match[8]) {
            // Inline code
            spans.push({ styles: ['code'], text: match[9], url: artifactUrlForExactText(match[9]) });
        }

        lastIndex = pattern.lastIndex;
    }

    // If there's any text remaining after the last match, treat it as plain
    if (lastIndex < markdown.length) {
        pushTextWithAutoLinks(spans, markdown.slice(lastIndex), []);
    }

    return spans;
}
