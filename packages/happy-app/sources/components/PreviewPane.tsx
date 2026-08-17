import { Ionicons } from '@expo/vector-icons';
import * as React from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { decodeBase64 } from '@/encryption/base64';
import { sessionReadFile } from '@/sync/ops';
import { openExternalUrl } from '@/utils/openExternalUrl';
import { MarkdownView } from '@/components/markdown/MarkdownView';
import type { SessionPreviewTarget } from '@/utils/sessionPreviewTargets';
import { registerSessionPreview, type RightPaneMode } from '@/-session/sessionPreviewStore';

type PreviewPaneProps = {
    sessionId: string;
    projectPath?: string | null;
    target: SessionPreviewTarget | null;
    mode: RightPaneMode;
    refreshSignal?: number;
    filesEnabled: boolean;
    onModeChange: (mode: RightPaneMode) => void;
    onCollapse: () => void;
    children?: React.ReactNode;
};

export const PreviewPane = React.memo(function PreviewPane({
    sessionId,
    projectPath,
    target,
    mode,
    refreshSignal,
    filesEnabled,
    onModeChange,
    onCollapse,
    children,
}: PreviewPaneProps) {
    const { theme } = useUnistyles();
    const [reloadKey, setReloadKey] = React.useState(0);
    const [addressText, setAddressText] = React.useState('');
    const canPreview = !!target && mode === 'preview';
    const canEmbedUrl = canPreview && target.kind === 'url' && canEmbedPreviewUrl(target.uri);

    React.useEffect(() => {
        setReloadKey((current) => current + 1);
    }, [refreshSignal, target?.id]);

    React.useEffect(() => {
        setAddressText(target?.kind === 'url' ? target.uri : '');
    }, [target?.kind, target?.uri]);

    const handleOpenExternal = React.useCallback(() => {
        if (target) openExternalUrl(externalUriForTarget(target));
    }, [target]);

    const handleAddressSubmit = React.useCallback(() => {
        const uri = normalizeAddressInput(addressText);
        if (!uri) return;
        registerSessionPreview(sessionId, {
            uri,
            title: titleForAddress(uri),
            kind: 'url',
        });
    }, [addressText, sessionId]);

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <View style={styles.tabRow}>
                    {target ? (
                        <ModeButton
                            icon="globe-outline"
                            label="Preview"
                            active={mode === 'preview'}
                            onPress={() => onModeChange('preview')}
                        />
                    ) : null}
                    {filesEnabled ? (
                        <ModeButton
                            icon="folder-open-outline"
                            label="Files"
                            active={mode === 'files'}
                            onPress={() => onModeChange('files')}
                        />
                    ) : null}
                </View>
                <View style={styles.actions}>
                    {mode === 'preview' && target ? (
                        <>
                            <IconButton
                                icon="refresh"
                                label="Reload preview"
                                onPress={() => setReloadKey((current) => current + 1)}
                            />
                            <IconButton
                                icon="open-outline"
                                label="Open externally"
                                onPress={handleOpenExternal}
                            />
                        </>
                    ) : null}
                    <IconButton icon="chevron-forward" label="Collapse pane" onPress={onCollapse} />
                </View>
            </View>

            {mode === 'preview' ? (
                <View style={styles.addressBar}>
                    <View style={styles.addressInputWrap}>
                        <Ionicons name="lock-closed-outline" size={13} color={theme.colors.textSecondary} />
                        <TextInput
                            value={addressText}
                            onChangeText={setAddressText}
                            onSubmitEditing={handleAddressSubmit}
                            placeholder={target?.kind === 'file' ? target.title : 'Enter a URL'}
                            placeholderTextColor={theme.colors.textSecondary}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            returnKeyType="go"
                            selectTextOnFocus
                            style={styles.addressInput}
                        />
                    </View>
                    <IconButton
                        icon="arrow-forward"
                        label="Go to address"
                        onPress={handleAddressSubmit}
                    />
                </View>
            ) : null}

            {mode === 'files' ? (
                <View style={styles.content}>{children}</View>
            ) : !target ? (
                <EmptyPreview title="No preview yet" subtitle="Live websites and previewable artifacts will appear here." />
            ) : canEmbedUrl ? (
                <View style={styles.webFrameWrap}>
                    {React.createElement('iframe', {
                        key: `${target.id}:${reloadKey}`,
                        src: target.uri,
                        title: target.title,
                        style: {
                            border: '0',
                            width: '100%',
                            height: '100%',
                            backgroundColor: theme.colors.surface,
                        },
                        sandbox: 'allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts',
                    })}
                </View>
            ) : target.kind === 'url' ? (
                <EmptyPreview
                    title={target.title}
                    subtitle={blockedPreviewMessage(target.uri)}
                    actionLabel="Open"
                    onAction={handleOpenExternal}
                />
            ) : target.kind === 'file' ? (
                <SessionFilePreview sessionId={sessionId} projectPath={projectPath} target={target} refreshSignal={reloadKey} />
            ) : (
                <EmptyPreview
                    title={target.title}
                    subtitle="This artifact cannot be embedded here yet."
                    actionLabel="Open"
                    onAction={handleOpenExternal}
                />
            )}
        </View>
    );
});

function normalizeAddressInput(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^localhost(?::\d+)?(?:[/?#].*)?$/i.test(trimmed)) return `http://${trimmed}`;
    if (/^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:[/?#].*)?$/i.test(trimmed)) return `http://${trimmed}`;
    return `https://${trimmed}`;
}

function titleForAddress(uri: string): string {
    try {
        const url = new URL(uri);
        return url.hostname || uri;
    } catch {
        return uri;
    }
}

function canEmbedPreviewUrl(uri: string): boolean {
    if (Platform.OS !== 'web') return false;

    try {
        const url = new URL(uri);
        const host = url.hostname.toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.localhost')) {
            return true;
        }

        if (typeof window !== 'undefined' && url.origin === window.location.origin) {
            return true;
        }
    } catch {
        return false;
    }

    return false;
}

function blockedPreviewMessage(uri: string): string {
    try {
        const host = new URL(uri).hostname;
        if (host.endsWith('.here.now')) {
            return 'here.now sites block embedded browser previews. Open this site in a new tab to view it.';
        }
    } catch {
        // Fall through to the generic message.
    }

    return 'This website blocks embedded previews. Open it in a new tab to view it.';
}

function SessionFilePreview({
    sessionId,
    projectPath,
    target,
    refreshSignal,
}: {
    sessionId: string;
    projectPath?: string | null;
    target: SessionPreviewTarget;
    refreshSignal: number;
}) {
    const { theme } = useUnistyles();
    const [state, setState] = React.useState<
        | { kind: 'loading' }
        | { kind: 'error'; message: string }
        | { kind: 'blob'; url: string; mime: string }
        | { kind: 'markdown'; text: string }
    >({ kind: 'loading' });

    React.useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        setState({ kind: 'loading' });

        (async () => {
            try {
                const readablePaths = sessionReadablePathCandidates(target.uri, projectPath);
                let response = await sessionReadFile(sessionId, readablePaths[0]);
                let readablePath = readablePaths[0];
                for (let i = 1; (!response.success || !response.content) && i < readablePaths.length; i++) {
                    readablePath = readablePaths[i];
                    response = await sessionReadFile(sessionId, readablePath);
                }
                if (cancelled) return;
                if (!response.success || !response.content) {
                    setState({ kind: 'error', message: friendlyReadError(response.error, target.title) });
                    return;
                }

                const bytes = decodeBase64(response.content);
                const mime = mimeForPath(readablePath);
                if (mime === 'text/markdown' || mime === 'text/html') {
                    const text = new TextDecoder().decode(bytes);
                    if (mime === 'text/markdown') {
                        setState({ kind: 'markdown', text });
                        return;
                    }
                }

                if (Platform.OS === 'web' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
                    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
                    objectUrl = URL.createObjectURL(new Blob([arrayBuffer], { type: mime }));
                    setState({ kind: 'blob', url: objectUrl, mime });
                    return;
                }

                setState({ kind: 'error', message: 'Open this artifact externally to preview it.' });
            } catch {
                if (!cancelled) setState({ kind: 'error', message: 'Could not preview this artifact.' });
            }
        })();

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [projectPath, refreshSignal, sessionId, target.id, target.uri]);

    if (state.kind === 'loading') {
        return (
            <View style={styles.empty}>
                <ActivityIndicator size="small" color={theme.colors.textSecondary} />
            </View>
        );
    }

    if (state.kind === 'markdown') {
        return (
            <ScrollView style={styles.content} contentContainerStyle={styles.markdownContent}>
                <MarkdownView markdown={state.text} sessionId={sessionId} />
            </ScrollView>
        );
    }

    if (state.kind === 'blob') {
        if (state.mime.startsWith('image/')) {
            return (
                <View style={styles.webFrameWrap}>
                    <Image source={{ uri: state.url }} style={styles.previewImage} resizeMode="contain" />
                </View>
            );
        }
        return (
            <View style={styles.webFrameWrap}>
                {React.createElement('iframe', {
                    key: `${target.id}:${refreshSignal}`,
                    src: state.url,
                    title: target.title,
                    style: {
                        border: '0',
                        width: '100%',
                        height: '100%',
                        backgroundColor: theme.colors.surface,
                    },
                })}
            </View>
        );
    }

    return (
        <EmptyPreview
            title={target.title}
            subtitle={state.message}
        />
    );
}

function externalUriForTarget(target: SessionPreviewTarget): string {
    if (target.kind !== 'file') {
        return target.uri;
    }

    if (target.uri.startsWith('file://')) {
        return target.uri;
    }

    const normalized = target.uri.replaceAll('\\', '/');
    const withLeadingSlash = /^[A-Za-z]:\//.test(normalized) ? `/${normalized}` : normalized;
    return `file://${encodeURI(withLeadingSlash)}`;
}

function sessionReadablePath(uri: string): string {
    if (!uri.startsWith('file://')) {
        return uri;
    }

    const decoded = decodeURIComponent(uri.slice('file://'.length));
    return decoded.replace(/^\/([A-Za-z]:\/)/, '$1');
}

function sessionReadablePathCandidates(uri: string, projectPath?: string | null): string[] {
    const primary = sessionReadablePath(uri);
    const candidates = [primary];
    const fileName = basenameFromPath(primary);

    if (fileName && fileName !== primary) {
        candidates.push(fileName);
    }

    if (fileName && projectPath) {
        const normalizedRoot = projectPath.replaceAll('\\', '/').replace(/\/+$/, '');
        const underProject = `${normalizedRoot}/${fileName}`;
        candidates.push(underProject);
    }

    return Array.from(new Set(candidates));
}

function basenameFromPath(path: string): string | null {
    const normalized = path.replaceAll('\\', '/').replace(/\/+$/, '');
    const parts = normalized.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? null;
}

function friendlyReadError(error: string | undefined, title: string): string {
    if (!error) {
        return 'Could not read this artifact from the session.';
    }

    if (/ENOENT|no such file or directory|File does not exist/i.test(error)) {
        return `I could not find ${title} in this session folder. The agent may need to save or recreate it first.`;
    }

    if (/Access denied|outside the working directory/i.test(error)) {
        return 'This artifact is outside the session folder, so Happy cannot preview it here.';
    }

    return error;
}

function mimeForPath(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
    if (lower.endsWith('.md')) return 'text/markdown';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    return 'application/octet-stream';
}

function ModeButton({
    icon,
    label,
    active,
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    const { theme } = useUnistyles();
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.modeButton,
                active && { backgroundColor: theme.colors.surface },
                pressed && styles.pressed,
            ]}
        >
            <Ionicons name={icon} size={14} color={active ? theme.colors.text : theme.colors.textSecondary} />
            <Text style={[styles.modeText, active && { color: theme.colors.text }]} numberOfLines={1}>
                {label}
            </Text>
        </Pressable>
    );
}

function IconButton({
    icon,
    label,
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress: () => void;
}) {
    const { theme } = useUnistyles();
    return (
        <Pressable
            accessibilityLabel={label}
            onPress={onPress}
            hitSlop={6}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
            <Ionicons name={icon} size={18} color={theme.colors.textSecondary} />
        </Pressable>
    );
}

function EmptyPreview({
    title,
    subtitle,
    actionLabel,
    onAction,
}: {
    title: string;
    subtitle: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    const { theme } = useUnistyles();
    return (
        <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
                <Ionicons name="eye-outline" size={30} color={theme.colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle} numberOfLines={2}>{title}</Text>
            <Text style={styles.emptySubtitle}>{subtitle}</Text>
            {actionLabel && onAction ? (
                <Pressable onPress={onAction} style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}>
                    <Text style={styles.openButtonText}>{actionLabel}</Text>
                </Pressable>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        backgroundColor: theme.colors.groupped.background,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderLeftColor: theme.colors.divider,
    },
    topBar: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.divider,
    },
    tabRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 2,
        padding: 2,
        borderRadius: 8,
        backgroundColor: theme.colors.groupped.background,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.divider,
    },
    modeButton: {
        minWidth: 0,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
    },
    modeText: {
        minWidth: 0,
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    addressBar: {
        minHeight: 42,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.divider,
        backgroundColor: theme.colors.groupped.background,
    },
    addressInputWrap: {
        minWidth: 0,
        flex: 1,
        height: 30,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        borderRadius: 7,
        backgroundColor: theme.colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.divider,
    },
    addressInput: {
        minWidth: 0,
        flex: 1,
        height: 28,
        paddingVertical: 0,
        paddingHorizontal: 0,
        color: theme.colors.text,
        fontSize: 13,
    },
    iconButton: {
        width: 30,
        height: 30,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: {
        opacity: 0.65,
    },
    content: {
        flex: 1,
    },
    webFrameWrap: {
        flex: 1,
        backgroundColor: theme.colors.surface,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    markdownContent: {
        padding: 16,
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        gap: 8,
    },
    emptyIconWrap: {
        width: 62,
        height: 62,
        borderRadius: 31,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.divider,
        marginBottom: 8,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.text,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
    openButton: {
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 7,
        backgroundColor: theme.colors.text,
    },
    openButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.surface,
    },
}));
