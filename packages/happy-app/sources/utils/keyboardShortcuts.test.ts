import { describe, expect, it } from 'vitest';
import {
    eventToShortcutBinding,
    findShortcutAction,
    formatShortcut,
    getShortcutBindingForAction,
    isEdgeReservedShortcut,
    shortcutEquals,
    shortcutToKey,
    validateShortcutBinding,
} from './keyboardShortcuts';

describe('keyboardShortcuts', () => {
    it('normalizes and formats shortcuts', () => {
        const binding = eventToShortcutBinding({
            key: 'K',
            altKey: true,
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
        });

        expect(shortcutToKey(binding)).toBe('alt+shift+k');
        expect(formatShortcut(binding)).toBe('Alt+Shift+K');
    });

    it('detects the default command palette shortcut', () => {
        const action = findShortcutAction(
            { key: 'k', alt: true, shift: true },
            {},
            'global',
        );

        expect(action?.id).toBe('app.openCommandPalette');
    });

    it('uses overrides for active bindings', () => {
        const binding = getShortcutBindingForAction('app.openCommandPalette', {
            'app.openCommandPalette': { key: 'q', alt: true, shift: true },
        });

        expect(shortcutEquals(binding!, { key: 'q', alt: true, shift: true })).toBe(true);
    });

    it('treats null overrides as unassigned', () => {
        expect(getShortcutBindingForAction('app.openCommandPalette', {
            'app.openCommandPalette': null,
        })).toBeNull();
    });

    it('blocks Microsoft Edge reserved shortcuts', () => {
        const binding = { key: 'k', ctrl: true };
        expect(isEdgeReservedShortcut(binding)).toBe(true);
        expect(validateShortcutBinding('app.openCommandPalette', binding, {}).ok).toBe(false);
    });

    it('blocks duplicate bindings', () => {
        const result = validateShortcutBinding('app.newSession', { key: 'k', alt: true, shift: true }, {});
        expect(result).toEqual({
            ok: false,
            reason: 'Alt+Shift+K is already used for Open command palette.',
        });
    });
});

