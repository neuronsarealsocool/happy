import * as React from 'react';
import { Header } from './navigation/Header';
import { useSocketStatus } from '@/sync/storage';
import { Platform, Pressable, Text, View } from 'react-native';
import { Typography } from '@/constants/Typography';
import { StatusDot } from './StatusDot';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { getServerInfo } from '@/sync/serverConfig';
import { Image } from 'expo-image';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { t } from '@/text';
import { ShortcutHintBadge, useShortcutHints } from './ShortcutHints';

const stylesheet = StyleSheet.create((theme, runtime) => ({
    headerButton: {
        // marginHorizontal: 4,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtonShortcutActive: {
        borderRadius: 8,
        backgroundColor: theme.colors.surfaceSelected,
    },
    headerShortcutBadge: {
        position: 'absolute',
        top: -8,
        right: -12,
    },
    iconButton: {
        color: theme.colors.header.tint,
    },
    logoContainer: {
        // marginHorizontal: 4,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        tintColor: theme.colors.header.tint,
    },
    titleContainer: {
        flex: 1,
        alignItems: Platform.OS === 'web' ? 'center' : 'flex-start',
    },
    titleText: {
        fontSize: Platform.OS === 'web' ? 17 : 31,
        lineHeight: Platform.OS === 'web' ? 22 : 36,
        color: Platform.OS === 'web' ? theme.colors.header.tint : '#050505',
        fontWeight: Platform.OS === 'web' ? '600' : '800',
        ...Typography.default('semiBold'),
    },
    subtitleText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginTop: -2,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: -2,
    },
    statusDot: {
        marginRight: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        ...Typography.default(),
    },
    // Status colors
    statusConnected: {
        color: theme.colors.status.connected,
    },
    statusConnecting: {
        color: theme.colors.status.connecting,
    },
    statusDisconnected: {
        color: theme.colors.status.disconnected,
    },
    statusError: {
        color: theme.colors.status.error,
    },
    statusDefault: {
        color: theme.colors.status.default,
    },
    centeredTitle: {
        textAlign: Platform.OS === 'ios' ? 'center' : 'left',
        alignSelf: Platform.OS === 'ios' ? 'center' : 'flex-start',
        flex: 1,
    },
}));


export const HomeHeader = React.memo(() => {
    const { theme } = useUnistyles();
    const header = (
        <Header
            title={<HeaderTitleWithSubtitle />}
            headerRight={() => <HeaderRight />}
            headerLeft={() => <HeaderLeft />}
            headerLeftGlass={Platform.OS !== 'web'}
            headerShadowVisible={false}
            headerTransparent={true}
        />
    );

    return Platform.OS === 'web'
        ? <View style={{ backgroundColor: theme.colors.groupped.background }}>{header}</View>
        : header;
})

export const HomeHeaderNotAuth = React.memo(() => {
    useSegments(); // Re-rendered automatically when screen navigates back
    const serverInfo = getServerInfo();
    const { theme } = useUnistyles();
    return (
        <Header
            title={<HeaderTitleWithSubtitle subtitle={serverInfo.isCustom ? serverInfo.hostname + (serverInfo.port ? `:${serverInfo.port}` : '') : undefined} />}
            headerRight={() => <HeaderRightNotAuth />}
            headerLeft={() => <HeaderLeft />}
            headerLeftGlass={Platform.OS !== 'web'}
            headerShadowVisible={false}
            headerBackgroundColor={theme.colors.groupped.background}
            mobileTitleSurface="plain"
        />
    )
});

function HeaderRight() {
    const router = useRouter();
    const styles = stylesheet;
    const { theme } = useUnistyles();
    const { visible: shortcutHintsVisible } = useShortcutHints();

    return (
        <Pressable
            onPress={() => router.navigate('/new')}
            hitSlop={15}
            style={[
                styles.headerButton,
                shortcutHintsVisible && styles.headerButtonShortcutActive,
            ]}
        >
            <Ionicons
                name={Platform.OS === 'web' ? 'add-outline' : 'create-outline'}
                size={Platform.OS === 'web' ? 28 : 32}
                color={Platform.OS === 'web' ? theme.colors.header.tint : '#0084FF'}
            />
            <ShortcutHintBadge shortcutKey="N" style={styles.headerShortcutBadge} />
        </Pressable>
    );
}

function HeaderRightNotAuth() {
    const router = useRouter();
    const { theme } = useUnistyles();
    const styles = stylesheet;


    return (
        <Pressable
            onPress={() => router.push('/server')}
            hitSlop={15}
            style={styles.headerButton}
        >
            <Ionicons name="server-outline" size={24} color={theme.colors.header.tint} />
        </Pressable>
    );
}

function HeaderLeft() {
    const styles = stylesheet;
    const { theme } = useUnistyles();
    return (
        <View style={styles.logoContainer}>
            {Platform.OS === 'web' ? (
                <Image
                    source={require('@/assets/images/logo-black.png')}
                    contentFit="contain"
                    style={[{ width: 24, height: 24 }]}
                    tintColor={theme.colors.header.tint}
                />
            ) : (
                <Ionicons name="menu" size={32} color="#0084FF" />
            )}
        </View>
    );
}

function HeaderTitleWithSubtitle({ subtitle }: { subtitle?: string }) {
    const socketStatus = useSocketStatus();
    const styles = stylesheet;

    // Get connection status styling (matching sessionUtils.ts pattern)
    const getConnectionStatus = () => {
        const { status } = socketStatus;
        switch (status) {
            case 'connected':
                return {
                    color: styles.statusConnected.color,
                    isPulsing: false,
                    text: t('status.connected'),
                    textColor: styles.statusConnected.color
                };
            case 'connecting':
                return {
                    color: styles.statusConnecting.color,
                    isPulsing: true,
                    text: t('status.connecting'),
                    textColor: styles.statusConnecting.color
                };
            case 'disconnected':
                return {
                    color: styles.statusDisconnected.color,
                    isPulsing: false,
                    text: t('status.disconnected'),
                    textColor: styles.statusDisconnected.color
                };
            case 'error':
                return {
                    color: styles.statusError.color,
                    isPulsing: false,
                    text: t('status.error'),
                    textColor: styles.statusError.color
                };
            default:
                return {
                    color: styles.statusDefault.color,
                    isPulsing: false,
                    text: '',
                    textColor: styles.statusDefault.color
                };
        }
    };

    const hasCustomSubtitle = !!subtitle;
    const connectionStatus = getConnectionStatus();
    const showConnectionStatus = !hasCustomSubtitle && connectionStatus.text;
    const showNativeMessengerTitle = Platform.OS !== 'web' && !subtitle;

    return (
        <View style={styles.titleContainer}>
            <Text style={styles.titleText}>
                {showNativeMessengerTitle ? 'messenger' : t('sidebar.sessionsTitle')}
            </Text>
            {hasCustomSubtitle && !showNativeMessengerTitle && (
                <Text style={styles.subtitleText}>
                    {subtitle}
                </Text>
            )}
            {showConnectionStatus && !showNativeMessengerTitle && (
                <View style={styles.statusContainer}>
                    <StatusDot
                        color={connectionStatus.color}
                        isPulsing={connectionStatus.isPulsing}
                        size={6}
                        style={styles.statusDot}
                    />
                    <Text style={[
                        styles.statusText,
                        { color: connectionStatus.textColor }
                    ]}>
                        {connectionStatus.text}
                    </Text>
                </View>
            )}
        </View>
    );
}
