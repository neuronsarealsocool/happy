import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Modal } from '@/modal';
import { CommandPalette } from './CommandPalette';
import { Command } from './types';
import { useAuth } from '@/auth/AuthContext';
import { storage, useAllMachines } from '@/sync/storage';
import { useShallow } from 'zustand/react/shallow';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { ShortcutHintsProvider } from '@/components/ShortcutHints';
import { getPreferredShortcutModifier } from '@/keyboard/shortcuts';
import { isTauri } from '@/utils/isTauri';
import { useVisibleSessionListViewData } from '@/hooks/useVisibleSessionListViewData';
import { getSessionShortcutIdsInDisplayOrder } from '@/utils/sessionDisplayOrder';
import { t } from '@/text';
import { useGlobalKeyboard } from '@/hooks/useGlobalKeyboard';
import { getSessionName, getSessionSubtitle } from '@/utils/sessionUtils';
import { useKeyboardShortcuts } from '@/components/KeyboardShortcuts/KeyboardShortcutProvider';

const EMPTY_SESSION_IDS: readonly string[] = [];

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { logout, isAuthenticated } = useAuth();
    const sessions = storage(useShallow((state) => state.sessions));
    const isDataReady = storage(useShallow((state) => state.isDataReady));
    const commandPaletteEnabled = storage(useShallow((state) => state.localSettings.commandPaletteEnabled));
    const sessionListViewData = useVisibleSessionListViewData();
    const machines = useAllMachines();
    const navigateToSession = useNavigateToSession();
    const preferredModifier = useMemo(() => getPreferredShortcutModifier(
        typeof navigator === 'undefined' ? undefined : navigator
    ), []);
    const browserSafeShortcuts = useMemo(() => Platform.OS === 'web' && !isTauri(), []);
    const visibleSessionShortcutIds = useMemo(() => getSessionShortcutIdsInDisplayOrder(
        sessionListViewData,
        machines,
        t('status.unknown'),
    ), [machines, sessionListViewData]);
    const openedOnStartup = useRef(false);
    const { registerShortcutHandler, getShortcutLabel } = useKeyboardShortcuts();

    const commands = useMemo((): Command[] => {
        const cmds: Command[] = [];

        const availableSessions = Object.values(sessions)
            .sort((a, b) => b.updatedAt - a.updatedAt);

        availableSessions.forEach(session => {
            cmds.push({
                id: `session-${session.id}`,
                title: getSessionName(session),
                subtitle: getSessionSubtitle(session),
                icon: 'chatbubble-outline',
                category: 'Available Sessions',
                action: () => {
                    navigateToSession(session.id);
                }
            });
        });

        cmds.push(
            {
                id: 'new-session',
                title: 'New Session',
                subtitle: 'Start a new chat session',
                icon: 'add-circle-outline',
                category: 'Sessions',
                shortcut: getShortcutLabel('app.newSession'),
                action: () => {
                    router.navigate('/new');
                }
            },
            {
                id: 'sessions',
                title: 'View All Sessions',
                subtitle: 'Browse your chat history',
                icon: 'chatbubbles-outline',
                category: 'Sessions',
                action: () => {
                    router.push('/');
                }
            },
            {
                id: 'settings',
                title: 'Settings',
                subtitle: 'Configure your preferences',
                icon: 'settings-outline',
                category: 'Navigation',
                shortcut: getShortcutLabel('app.openSettings'),
                action: () => {
                    router.push('/settings');
                }
            },
            {
                id: 'accessibility-settings',
                title: 'Accessibility Settings',
                subtitle: 'Configure keyboard shortcuts',
                icon: 'accessibility-outline',
                category: 'Navigation',
                shortcut: getShortcutLabel('app.showShortcuts'),
                action: () => {
                    router.push('/settings/accessibility');
                }
            },
            {
                id: 'account',
                title: 'Account',
                subtitle: 'Manage your account',
                icon: 'person-circle-outline',
                category: 'Navigation',
                action: () => {
                    router.push('/settings/account');
                }
            },
            {
                id: 'connect',
                title: 'Connect Device',
                subtitle: 'Connect a new device via web',
                icon: 'link-outline',
                category: 'Navigation',
                action: () => {
                    router.push('/terminal/connect');
                }
            },
        );

        cmds.push({
            id: 'sign-out',
            title: 'Sign Out',
            subtitle: 'Sign out of your account',
            icon: 'log-out-outline',
            category: 'System',
            action: async () => {
                await logout();
            }
        });

        if (__DEV__) {
            cmds.push({
                id: 'dev-menu',
                title: 'Developer Menu',
                subtitle: 'Access developer tools',
                icon: 'code-slash-outline',
                category: 'Developer',
                action: () => {
                    router.push('/dev');
                }
            });
        }

        return cmds;
    }, [getShortcutLabel, router, logout, navigateToSession, sessions]);

    const showCommandPalette = useCallback((options?: { ignoreEnabled?: boolean }) => {
        if (Platform.OS !== 'web' || !isAuthenticated || (!commandPaletteEnabled && !options?.ignoreEnabled)) return;

        Modal.show({
            component: CommandPalette,
            props: {
                commands,
            }
        } as any);
    }, [commands, commandPaletteEnabled, isAuthenticated]);

    const openNewSession = useCallback(() => {
        router.navigate('/new');
    }, [router]);

    const openSettings = useCallback(() => {
        router.push('/settings');
    }, [router]);

    const openRecentSession = useCallback((index: number) => {
        const sessionId = visibleSessionShortcutIds[index];
        if (!sessionId) {
            return false;
        }
        navigateToSession(sessionId);
        return true;
    }, [navigateToSession, visibleSessionShortcutIds]);

    const visibleModifier = useGlobalKeyboard(
        {
            commandPalette: isAuthenticated && commandPaletteEnabled ? () => showCommandPalette() : undefined,
            newSession: isAuthenticated ? openNewSession : undefined,
            settings: isAuthenticated ? openSettings : undefined,
            recentSession: isAuthenticated ? openRecentSession : undefined,
        },
        browserSafeShortcuts,
    );

    useEffect(() => registerShortcutHandler('app.openCommandPalette', () => {
        showCommandPalette({ ignoreEnabled: true });
    }), [registerShortcutHandler, showCommandPalette]);

    useEffect(() => {
        if (openedOnStartup.current || !isAuthenticated || !isDataReady || Platform.OS !== 'web') {
            return;
        }

        openedOnStartup.current = true;
        const handle = setTimeout(() => showCommandPalette({ ignoreEnabled: true }), 0);
        return () => clearTimeout(handle);
    }, [isAuthenticated, isDataReady, showCommandPalette]);

    return (
        <ShortcutHintsProvider
            modifier={isAuthenticated ? visibleModifier : null}
            commandPaletteEnabled={isAuthenticated && commandPaletteEnabled}
            recentSessionIds={isAuthenticated ? visibleSessionShortcutIds : EMPTY_SESSION_IDS}
            browserSafeShortcuts={browserSafeShortcuts}
        >
            {children}
        </ShortcutHintsProvider>
    );
}
