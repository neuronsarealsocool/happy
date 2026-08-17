import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { Modal } from '@/modal';
import { storage, useLocalSetting } from '@/sync/storage';

const PROFILE_PICTURE_SIZE = 256;
const PROFILE_PICTURE_QUALITY = 0.86;

export function useSessionProfilePicture(sessionId: string): string | null {
    const pictures = useLocalSetting('sessionProfilePictures');
    return pictures[sessionId] ?? null;
}

export function setSessionProfilePicture(sessionId: string, imageUrl: string) {
    const pictures = storage.getState().localSettings.sessionProfilePictures;
    storage.getState().applyLocalSettings({
        sessionProfilePictures: {
            ...pictures,
            [sessionId]: imageUrl,
        },
    });
}

export function clearSessionProfilePicture(sessionId: string) {
    const pictures = storage.getState().localSettings.sessionProfilePictures;
    if (!pictures[sessionId]) {
        return;
    }
    const next = { ...pictures };
    delete next[sessionId];
    storage.getState().applyLocalSettings({ sessionProfilePictures: next });
}

export async function pickAndSaveSessionProfilePicture(sessionId: string): Promise<boolean> {
    try {
        if (Platform.OS !== 'web') {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permission.status !== 'granted') {
                Modal.alert('Permission needed', 'Happy needs photo library access to choose a conversation picture.');
                return false;
            }
        }

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
