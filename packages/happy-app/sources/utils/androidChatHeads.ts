import { NativeModules, Platform } from 'react-native';

type HappyChatHeadsModule = {
    canDrawOverlays: () => Promise<boolean>;
    openOverlaySettings: () => void;
    canReadNotifications: () => Promise<boolean>;
    openNotificationListenerSettings: () => void;
    showTestChatHead: (title?: string, body?: string, sessionId?: string, avatarUri?: string) => void;
};

const nativeModule = NativeModules.HappyChatHeads as HappyChatHeadsModule | undefined;

export async function canUseAndroidChatHeads(): Promise<boolean> {
    if (Platform.OS !== 'android' || !nativeModule) {
        return false;
    }
    return nativeModule.canDrawOverlays();
}

export function openAndroidChatHeadSettings() {
    if (Platform.OS !== 'android' || !nativeModule) {
        return;
    }
    nativeModule.openOverlaySettings();
}

export async function canUseAndroidNotificationAccess(): Promise<boolean> {
    if (Platform.OS !== 'android' || !nativeModule) {
        return false;
    }
    return nativeModule.canReadNotifications();
}

export function openAndroidNotificationAccessSettings() {
    if (Platform.OS !== 'android' || !nativeModule) {
        return;
    }
    nativeModule.openNotificationListenerSettings();
}

export function showAndroidChatHeadPreview() {
    if (Platform.OS !== 'android' || !nativeModule) {
        return;
    }
    nativeModule.showTestChatHead(
        'Happy',
        'Chat heads are ready. New notifications can pop over other apps.',
        '',
        ''
    );
}
