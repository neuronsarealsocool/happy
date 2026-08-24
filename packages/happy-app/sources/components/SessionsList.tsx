import React from 'react';
import { View, Pressable, FlatList, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView } from 'react-native';
import { Text } from '@/components/StyledText';
import { usePathname, useRouter } from 'expo-router';
import { SessionListViewItem, SessionRowData } from '@/sync/storage';
import { filterProjectGroup, sessionMatchesQuery } from '@/sync/projectGroups';
import { Ionicons } from '@expo/vector-icons';
import { type SessionState, formatLastSeen, vibingMessages } from '@/utils/sessionUtils';
import { ActiveSessionsGroupCompact } from './ActiveSessionsGroupCompact';
import { ProjectGroup } from './ProjectGroup';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVisibleSessionListViewData } from '@/hooks/useVisibleSessionListViewData';
import { Typography } from '@/constants/Typography';
import { StatusDot } from './StatusDot';
import { StyleSheet } from 'react-native-unistyles';
import { useIsTablet } from '@/utils/responsive';
import { requestReview } from '@/utils/requestReview';
import { UpdateBanner } from './UpdateBanner';
import { layout } from './layout';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { SessionActionsAnchor, SessionActionsPopover } from './SessionActionsPopover';
import { useSessionActionAlert } from '@/hooks/useSessionQuickActions';
import { t } from '@/text';
import { SessionShortcutHintBadge } from './ShortcutHints';
import { ProviderIcon } from './ProviderIcon';
import { SessionProfilePictureAvatar } from './SessionProfilePictureAvatar';

const MESSENGER_BLUE = '#0084FF';
const MESSENGER_ONLINE = '#31C735';

const stylesheet = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'stretch',
        backgroundColor: theme.colors.surface,
    },
    contentContainer: {
        flex: 1,
        maxWidth: layout.maxWidth,
    },
    headerSection: {
        backgroundColor: theme.colors.surface,
        paddingHorizontal: Platform.OS === 'web' ? 20 : 26,
        paddingTop: Platform.OS === 'web' ? 18 : 20,
        paddingBottom: Platform.OS === 'web' ? 6 : 8,
    },
    headerText: {
        fontSize: Platform.OS === 'web' ? 13 : 20,
        fontWeight: Platform.OS === 'web' ? '600' : '800',
        color: Platform.OS === 'web' ? theme.colors.groupped.sectionTitle : '#111111',
        ...Typography.default('semiBold'),
    },
    projectGroup: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: Platform.select({ web: theme.colors.surface, default: theme.colors.surfaceHigh }),
    },
    projectGroupTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.text,
        ...Typography.default('semiBold'),
    },
    projectGroupSubtitle: {
        fontSize: 11,
        color: theme.colors.textSecondary,
        marginTop: 2,
        ...Typography.default(),
    },
    sessionItem: {
        height: Platform.OS === 'web' ? 78 : 92,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Platform.OS === 'web' ? 14 : 22,
        backgroundColor: 'transparent',
    },
    sessionItemContainer: {
        marginHorizontal: 8,
        marginBottom: 2,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderColor: 'transparent',
    },
    sessionItemFirst: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    sessionItemLast: {
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    sessionItemSingle: {
        borderRadius: 20,
    },
    sessionItemContainerFirst: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    sessionItemContainerLast: {
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        marginBottom: 10,
    },
    sessionItemContainerSingle: {
        borderRadius: 20,
        marginBottom: 10,
    },
    sessionItemSelected: {
        backgroundColor: theme.colors.surfaceSelected,
    },
    sessionContent: {
        flex: 1,
        marginLeft: Platform.OS === 'web' ? 14 : 18,
        paddingRight: Platform.select({ web: 0, default: 12 }),
        justifyContent: 'center',
    },
    sessionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    sessionTitle: {
        fontSize: Platform.OS === 'web' ? 17 : 20,
        fontWeight: Platform.OS === 'web' ? '600' : '800',
        flex: 1,
        ...Typography.default('semiBold'),
    },
    sessionShortcutBadge: {
        flexShrink: 0,
        marginLeft: 8,
    },
    sessionTitleConnected: {
        color: theme.colors.text,
    },
    sessionTitleDisconnected: {
        color: theme.colors.textSecondary,
    },
    sessionSubtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    sessionSubtitle: {
        fontSize: Platform.OS === 'web' ? 14 : 17,
        color: theme.colors.textSecondary,
        flexShrink: 1,
        ...Typography.default(),
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        display: Platform.OS === 'web' ? 'flex' : 'none',
    },
    statusDotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 16,
        marginTop: 2,
        marginRight: 4,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 16,
        ...Typography.default(),
    },
    avatarContainer: {
        position: 'relative',
        width: Platform.OS === 'web' ? 56 : 64,
        height: Platform.OS === 'web' ? 56 : 64,
    },
    draftIconContainer: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    draftIconOverlay: {
        color: theme.colors.textSecondary,
    },
    artifactsSection: {
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: Platform.select({ web: theme.colors.groupped.background, default: 'transparent' }),
    },
    pictureButton: {
        position: 'absolute',
        left: 52,
        top: 46,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        borderWidth: 2,
        borderColor: theme.colors.surface,
    },
    pictureButtonIcon: {
        color: theme.colors.text,
    },
    messengerDiscovery: {
        paddingHorizontal: 22,
        paddingBottom: 14,
        backgroundColor: '#FFFFFF',
    },
    messengerSearch: {
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F0F2F5',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 10,
        marginBottom: 18,
    },
    messengerSearchText: {
        fontSize: 20,
        color: '#65676B',
        ...Typography.default(),
    },
    messengerStories: {
        paddingRight: 8,
    },
    storyItem: {
        width: 80,
        alignItems: 'center',
        marginRight: 12,
    },
    createStoryCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F2F5',
        marginBottom: 8,
    },
    storyRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: MESSENGER_BLUE,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        backgroundColor: '#FFFFFF',
    },
    storyOnlineDot: {
        position: 'absolute',
        right: 2,
        bottom: 8,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: MESSENGER_ONLINE,
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    storyLabel: {
        fontSize: 14,
        lineHeight: 18,
        color: '#1C1E21',
        textAlign: 'center',
        ...Typography.default(),
    },
    sessionMetaRight: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        minWidth: 72,
        gap: 12,
    },
    sessionTime: {
        fontSize: 16,
        color: '#65676B',
        ...Typography.default(),
    },
    sessionTimeUnread: {
        color: MESSENGER_BLUE,
        fontWeight: '700',
        ...Typography.default('semiBold'),
    },
    unreadDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: MESSENGER_BLUE,
    },
}));

function MessengerDiscoveryHeader({ sessions }: { sessions: SessionRowData[] }) {
    const styles = stylesheet;
    const router = useRouter();
    const navigateToSession = useNavigateToSession();

    if (Platform.OS === 'web') {
        return <UpdateBanner />;
    }

    return (
        <View style={styles.messengerDiscovery}>
            <UpdateBanner />
            <View style={styles.messengerSearch}>
                <Ionicons name="search" size={24} color="#65676B" />
                <Text style={styles.messengerSearchText}>Search</Text>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.messengerStories}
            >
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Create story"
                    onPress={() => router.navigate('/new')}
                    style={styles.storyItem}
                >
                    <View style={styles.createStoryCircle}>
                        <Ionicons name="add" size={36} color={MESSENGER_BLUE} />
                    </View>
                    <Text style={styles.storyLabel} numberOfLines={2}>Create story</Text>
                </Pressable>
                {sessions.slice(0, 6).map((session) => (
                    <Pressable
                        key={session.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${session.name}`}
                        onPress={() => navigateToSession(session.id)}
                        style={styles.storyItem}
                    >
                        <View style={styles.storyRing}>
                            <SessionProfilePictureAvatar
                                sessionId={session.id}
                                avatarId={session.avatarId}
                                size={62}
                                monochrome={false}
                                flavor={session.flavor}
                                clientId={session.clientId}
                                editable
                            />
                            <View style={styles.storyOnlineDot} />
                        </View>
                        <Text style={styles.storyLabel} numberOfLines={1}>{session.name}</Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

export function SessionsList({
    topContentInset = 0,
    bottomContentInset = 128,
    onScroll,
    searchQuery = '',
}: {
    topContentInset?: number;
    bottomContentInset?: number;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    searchQuery?: string;
} = {}) {
    const styles = stylesheet;
    const safeArea = useSafeAreaInsets();
    const sourceData = useVisibleSessionListViewData();
    const pathname = usePathname();
    const isTablet = useIsTablet();
    // Selection is derived once from pathname so the data array stays stable
    // across navigations. This keeps FlatList virtualization intact: only
    // the previously- and newly-selected rows re-render, instead of the
    // whole visible window.
    const selectedSessionId = React.useMemo<string | undefined>(() => {
        if (!isTablet) return undefined;
        if (!pathname.startsWith('/session/')) return undefined;
        return pathname.split('/')[2];
    }, [isTablet, pathname]);

    // Request review
    React.useEffect(() => {
        if (sourceData && sourceData.length > 0) {
            requestReview();
        }
    }, [sourceData && sourceData.length > 0]);

    const data = React.useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
        if (!sourceData || !normalizedQuery) {
            return sourceData;
        }

        const matches = (session: SessionRowData) => sessionMatchesQuery(session, normalizedQuery);

        // Projects nest their sessions inside worktrees, so they need a pass of
        // their own: the index walk below only ever sees flat `session` items.
        const keptProjects = new Map<number, SessionListViewItem>();
        const keptProjectSources = new Set<'rig' | 'happy'>();
        sourceData.forEach((item, index) => {
            if (item.type !== 'project') return;
            const project = filterProjectGroup(item.project, normalizedQuery);
            if (project) {
                keptProjects.set(index, { ...item, project });
                keptProjectSources.add(item.source);
            }
        });

        const keepIndices = new Set<number>();
        let currentHeaderIndex: number | null = null;
        let currentProjectIndex: number | null = null;

        sourceData.forEach((item, index) => {
            if (item.type === 'header') {
                currentHeaderIndex = index;
                currentProjectIndex = null;
                return;
            }
            if (item.type === 'project-group') {
                currentProjectIndex = index;
                return;
            }
            if (item.type === 'session' && matches(item.session)) {
                keepIndices.add(index);
                if (currentHeaderIndex !== null) keepIndices.add(currentHeaderIndex);
                if (currentProjectIndex !== null) keepIndices.add(currentProjectIndex);
            }
        });

        const result: SessionListViewItem[] = [];
        sourceData.forEach((item, index) => {
            if (item.type === 'active-sessions') {
                const sessions = item.sessions.filter(matches);
                if (sessions.length > 0) result.push({ ...item, sessions });
                return;
            }
            if (item.type === 'projects-header') {
                if (keptProjectSources.has(item.source)) result.push(item);
                return;
            }
            if (item.type === 'project') {
                const kept = keptProjects.get(index);
                if (kept) result.push(kept);
                return;
            }
            if (keepIndices.has(index)) result.push(item);
        });
        return result;
    }, [searchQuery, sourceData]);

    const storySessions = React.useMemo(() => {
        if (!data) return [];
        const sessions: SessionRowData[] = [];
        for (const item of data) {
            if (item.type === 'session') sessions.push(item.session);
            if (item.type === 'active-sessions') sessions.push(...item.sessions);
            if (sessions.length >= 6) break;
        }
        return sessions;
    }, [data]);

    // Early return if no data yet
    if (!data) {
        return (
            <View style={styles.container} />
        );
    }

    const keyExtractor = React.useCallback((item: SessionListViewItem, index: number) => {
        switch (item.type) {
            case 'header': return `header-${item.title}-${index}`;
            case 'active-sessions': return 'active-sessions';
            case 'project-group': return `project-group-${item.machine.id}-${item.displayPath}-${index}`;
            case 'projects-header': return `projects-header-${item.source}`;
            case 'project': return `project-${item.project.id}`;
            case 'session': return `session-${item.session.id}`;
        }
    }, []);

    const renderItem = React.useCallback(({ item, index }: { item: SessionListViewItem, index: number }) => {
        switch (item.type) {
            case 'header':
                return (
                    <View style={styles.headerSection}>
                        <Text style={styles.headerText}>
                            {item.title}
                        </Text>
                    </View>
                );

            case 'active-sessions':
                return (
                    <ActiveSessionsGroupCompact
                        sessions={item.sessions}
                        selectedSessionId={selectedSessionId}
                    />
                );

            case 'projects-header':
                return (
                    <View style={styles.headerSection}>
                        <Text style={styles.headerText}>
                            {item.source === 'rig' ? 'Rig' : t('sidebar.sessionsTitle')}
                        </Text>
                    </View>
                );

            case 'project':
                return (
                    <ProjectGroup
                        project={item.project}
                        selectedSessionId={selectedSessionId}
                    />
                );

            case 'project-group':
                return (
                    <View style={styles.projectGroup}>
                        <Text style={styles.projectGroupTitle}>
                            {item.displayPath}
                        </Text>
                        <Text style={styles.projectGroupSubtitle}>
                            {item.machine.metadata?.displayName || item.machine.metadata?.host || item.machine.id}
                        </Text>
                    </View>
                );

            case 'session':
                // Determine card styling based on position within date group
                const prevItem = index > 0 ? data[index - 1] : null;
                const nextItem = index < data.length - 1 ? data[index + 1] : null;

                const isFirst = prevItem?.type === 'header';
                const isLast = nextItem?.type === 'header' || nextItem == null || nextItem?.type === 'active-sessions';
                const isSingle = isFirst && isLast;
                const selected = item.session.id === selectedSessionId;

                return (
                    <SessionItem
                        session={item.session}
                        selected={selected}
                        isFirst={isFirst}
                        isLast={isLast}
                        isSingle={isSingle}
                    />
                );
        }
    }, [selectedSessionId, data]);


    // Remove this section as we'll use FlatList for all items now


    const HeaderComponent = React.useCallback(() => {
        return <MessengerDiscoveryHeader sessions={storySessions} />;
    }, [storySessions]);

    // Footer removed - all sessions now shown inline

    return (
        <View style={styles.container}>
            <View style={styles.contentContainer}>
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    extraData={selectedSessionId}
                    contentContainerStyle={{
                        paddingTop: topContentInset,
                        paddingBottom: safeArea.bottom + bottomContentInset,
                        maxWidth: layout.maxWidth,
                    }}
                    ListHeaderComponent={HeaderComponent}
                    ListEmptyComponent={searchQuery.trim() ? (
                        <View style={{ paddingTop: 48, alignItems: 'center' }}>
                            <Text style={styles.headerText}>{t('sessionHistory.empty')}</Text>
                        </View>
                    ) : null}
                    windowSize={5}
                    maxToRenderPerBatch={8}
                    initialNumToRender={12}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                />
            </View>
        </View>
    );
}

const STATUS_CONFIG: Record<SessionState, { color: string; dotColor: string; isPulsing: boolean; isConnected: boolean }> = {
    disconnected: { color: '#999', dotColor: '#999', isPulsing: false, isConnected: false },
    thinking: { color: '#007AFF', dotColor: '#007AFF', isPulsing: true, isConnected: true },
    waiting: { color: '#34C759', dotColor: '#34C759', isPulsing: false, isConnected: true },
    permission_required: { color: '#FF9500', dotColor: '#FF9500', isPulsing: true, isConnected: true },
};

const SessionItem = React.memo(({ session, selected, isFirst, isLast, isSingle }: {
    session: SessionRowData;
    selected?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
    isSingle?: boolean;
}) => {
    const styles = stylesheet;
    const navigateToSession = useNavigateToSession();
    const [actionsAnchor, setActionsAnchor] = React.useState<SessionActionsAnchor | null>(null);
    const baseStatus = STATUS_CONFIG[session.state];
    // Override to solid blue when session has unread results
    const status = session.hasUnread
        ? { ...baseStatus, color: '#007AFF', dotColor: '#007AFF', isPulsing: false, isConnected: baseStatus.isConnected }
        : baseStatus;

    const vibingMessage = React.useMemo(() => {
        return vibingMessages[Math.floor(Math.random() * vibingMessages.length)].toLowerCase() + '…';
    }, [session.state]);

    const statusText = session.hasUnread
        ? t('status.unread')
        : session.state === 'thinking'
            ? vibingMessage
            : session.state === 'disconnected'
                ? t('status.lastSeen', { time: formatLastSeen(session.activeAt!, false) })
                : session.state === 'permission_required'
                    ? t('status.permissionRequired')
                    : t('status.online');

    const handlePress = React.useCallback(() => {
        navigateToSession(session.id);
    }, [navigateToSession, session.id]);

    const handleContextMenu = React.useCallback((event: any) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        setActionsAnchor({
            type: 'point',
            x: event.nativeEvent.clientX ?? event.nativeEvent.pageX ?? 0,
            y: event.nativeEvent.clientY ?? event.nativeEvent.pageY ?? 0,
        });
    }, []);

    const showActionAlert = useSessionActionAlert(session.id);
    const menuProps = Platform.OS === 'web' ? {
        onContextMenu: handleContextMenu,
    } as any : {
        onLongPress: showActionAlert,
    };

    return (
        <View style={[
            styles.sessionItemContainer,
            isSingle ? styles.sessionItemContainerSingle :
                isFirst ? styles.sessionItemContainerFirst :
                    isLast ? styles.sessionItemContainerLast : {}
        ]}>
        <Pressable
            style={[
                styles.sessionItem,
                selected && styles.sessionItemSelected,
                isSingle ? styles.sessionItemSingle :
                    isFirst ? styles.sessionItemFirst :
                        isLast ? styles.sessionItemLast : {}
            ]}
            onPress={handlePress}
            {...menuProps}
        >
            <View style={styles.avatarContainer}>
                <SessionProfilePictureAvatar
                    sessionId={session.id}
                    avatarId={session.avatarId}
                    size={Platform.OS === 'web' ? 56 : 64}
                    monochrome={!status.isConnected}
                    flavor={session.flavor}
                    clientId={session.clientId}
                    editable
                />
                {session.hasDraft && (
                    <View style={styles.draftIconContainer}>
                        <Ionicons
                            name="create-outline"
                            size={12}
                            style={styles.draftIconOverlay}
                        />
                    </View>
                )}
            </View>
            <View style={styles.sessionContent}>
                <View style={styles.sessionTitleRow}>
                    <Text style={[
                        styles.sessionTitle,
                        status.isConnected ? styles.sessionTitleConnected : styles.sessionTitleDisconnected
                    ]} numberOfLines={1}>
                        {session.name}
                    </Text>
                    <SessionShortcutHintBadge
                        sessionId={session.id}
                        style={styles.sessionShortcutBadge}
                    />
                </View>

                {session.identityLine ? (
                    <View style={styles.sessionSubtitleRow}>
                        <ProviderIcon kind={session.providerKind} size={13} />
                        <Text style={styles.sessionSubtitle} numberOfLines={1}>
                            {session.identityLine}
                        </Text>
                    </View>
                ) : session.path ? (
                    <View style={styles.sessionSubtitleRow}>
                        <Text style={styles.sessionSubtitle} numberOfLines={1}>
                            {session.path.split(/[/\\]/).filter(Boolean).pop()}
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.sessionSubtitle} numberOfLines={1}>
                        {session.subtitle}
                    </Text>
                )}

                <View style={styles.statusRow}>
                    <View style={styles.statusDotContainer}>
                        <StatusDot color={status.dotColor} isPulsing={status.isPulsing} />
                    </View>
                    <Text style={[
                        styles.statusText,
                        { color: status.color }
                    ]}>
                        {session.modelName ? `${session.modelName} · ` : ''}{statusText}{session.activitySummary ? ` · ${session.activitySummary}` : ''}
                    </Text>
                </View>
            </View>
            {Platform.OS !== 'web' && (
                <View style={styles.sessionMetaRight}>
                    <Text style={[styles.sessionTime, session.hasUnread && styles.sessionTimeUnread]} numberOfLines={1}>
                        {session.hasUnread ? 'Now' : formatLastSeen(session.activeAt!, true)}
                    </Text>
                    {session.hasUnread ? <View style={styles.unreadDot} /> : null}
                </View>
            )}
        </Pressable>
        {Platform.OS === 'web' && (
            <SessionActionsPopover
                anchor={actionsAnchor}
                onClose={() => setActionsAnchor(null)}
                sessionId={session.id}
                visible={!!actionsAnchor}
            />
        )}
        </View>
    );
});
