import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import { Modal } from '@/modal';
import { storage, useLocalSetting, useSetting } from '@/sync/storage';
import { sync } from '@/sync/sync';

const PROFILE_PICTURE_SIZE = 256;
const PROFILE_PICTURE_QUALITY = 0.86;

export function useSessionProfilePicture(sessionId: string): string | null {
    const syncedPictures = useSetting('sessionProfilePictures');
    const legacyLocalPictures = useLocalSetting('sessionProfilePictures');
    return syncedPictures[sessionId] ?? legacyLocalPictures[sessionId] ?? null;
}

export function setSessionProfilePicture(sessionId: string, imageUrl: string) {
    const pictures = storage.getState().settings.sessionProfilePictures;
    sync.applySettings({
        sessionProfilePictures: {
            ...pictures,
            [sessionId]: imageUrl,
        },
    });

    const legacyLocalPictures = storage.getState().localSettings.sessionProfilePictures;
    if (legacyLocalPictures[sessionId]) {
        const next = { ...legacyLocalPictures };
        delete next[sessionId];
        storage.getState().applyLocalSettings({ sessionProfilePictures: next });
    }
}

export function clearSessionProfilePicture(sessionId: string) {
    const pictures = storage.getState().settings.sessionProfilePictures;
    const legacyLocalPictures = storage.getState().localSettings.sessionProfilePictures;
    if (!pictures[sessionId] && !legacyLocalPictures[sessionId]) {
        return;
    }
    if (pictures[sessionId]) {
        const next = { ...pictures };
        delete next[sessionId];
        sync.applySettings({ sessionProfilePictures: next });
    }
    if (legacyLocalPictures[sessionId]) {
        const nextLocal = { ...legacyLocalPictures };
        delete nextLocal[sessionId];
        storage.getState().applyLocalSettings({ sessionProfilePictures: nextLocal });
    }
}

export function migrateLocalSessionProfilePicturesToSyncedSettings() {
    const legacyLocalPictures = storage.getState().localSettings.sessionProfilePictures;
    const entries = Object.entries(legacyLocalPictures);
    if (entries.length === 0) {
        return;
    }

    sync.applySettings({
        sessionProfilePictures: {
            ...legacyLocalPictures,
            ...storage.getState().settings.sessionProfilePictures,
        },
    });
    storage.getState().applyLocalSettings({ sessionProfilePictures: {} });
}

export async function pickAndSaveSessionProfilePicture(sessionId: string): Promise<boolean> {
    try {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: false,
            quality: 1,
            exif: false,
        });

        if (result.canceled || !result.assets.length) {
            return false;
        }

        const asset = result.assets[0];
        const resizeAction: Action = asset.width >= asset.height
            ? { resize: { width: PROFILE_PICTURE_SIZE } }
            : { resize: { height: PROFILE_PICTURE_SIZE } };
        const resized = await manipulateAsync(asset.uri, [resizeAction], {
            compress: PROFILE_PICTURE_QUALITY,
            format: SaveFormat.JPEG,
            base64: true,
        });

        if (!resized.base64) {
            Modal.alert('Unable to save picture', 'Happy could not read that image. Please try another file.');
            return false;
        }

        setSessionProfilePicture(sessionId, `data:image/jpeg;base64,${resized.base64}`);
        return true;
    } catch (error) {
        Modal.alert('Unable to save picture', error instanceof Error ? error.message : 'Please try another image.');
        return false;
    }
}
