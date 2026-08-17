export type KeyboardShortcutActionId =
    | 'app.openCommandPalette'
    | 'app.newSession'
    | 'app.focusPrompt'
    | 'app.focusSidebar'
    | 'app.focusTranscript'
    | 'app.openSettings'
    | 'app.showShortcuts'
    | 'composer.send'
    | 'composer.attach'
    | 'session.stop'
    | 'message.copyLatest'
    | 'artifact.openLatest'
    | 'pane.openPreview'
    | 'pane.openFiles'
    | 'message.previous'
    | 'message.next';

export type KeyboardShortcutScope = 'global' | 'composer';

export type KeyboardShortcutBinding = {
    key: string;
    alt?: boolean;
    shift?: boolean;
    ctrl?: boolean;
    meta?: boolean;
};

export type KeyboardShortcutDefinition = {
    id: KeyboardShortcutActionId;
    label: string;
    category: string;
    scope: KeyboardShortcutScope;
    defaultBinding: KeyboardShortcutBinding;
    readonly?: boolean;
};

export type KeyboardShortcutOverrides = Partial<Record<KeyboardShortcutActionId, KeyboardShortcutBinding | null>>;

export const KEYBOARD_SHORTCUT_DEFINITIONS: KeyboardShortcutDefinition[] = [
    { id: 'app.openCommandPalette', label: 'Open command palette', category: 'Navigation', scope: 'global', defaultBinding: { key: 'k', alt: true, shift: true } },
    { id: 'app.newSession', label: 'New session', category: 'Navigation', scope: 'global', defaultBinding: { key: 'n', alt: true, shift: true } },
    { id: 'app.focusPrompt', label: 'Focus prompt box', category: 'Session', scope: 'global', defaultBinding: { key: 'p', alt: true, shift: true } },
    { id: 'app.focusSidebar', label: 'Focus session list', category: 'Navigation', scope: 'global', defaultBinding: { key: 's', alt: true, shift: true } },
    { id: 'app.focusTranscript', label: 'Focus message transcript', category: 'Session', scope: 'global', defaultBinding: { key: 'm', alt: true, shift: true } },
    { id: 'composer.send', label: 'Send prompt', category: 'Composer', scope: 'composer', defaultBinding: { key: 'enter', ctrl: true } },
    { id: 'composer.attach', label: 'Open attachment uploader', category: 'Composer', scope: 'global', defaultBinding: { key: 'a', alt: true, shift: true } },
    { id: 'session.stop', label: 'Stop current response', category: 'Session', scope: 'global', defaultBinding: { key: 'x', alt: true, shift: true } },
    { id: 'message.previous', label: 'Previous message', category: 'Messages', scope: 'global', defaultBinding: { key: 'arrowup', alt: true, shift: true } },
    { id: 'message.next', label: 'Next message', category: 'Messages', scope: 'global', defaultBinding: { key: 'arrowdown', alt: true, shift: true } },
    { id: 'message.copyLatest', label: 'Copy latest assistant response', category: 'Messages', scope: 'global', defaultBinding: { key: 'c', alt: true, shift: true } },
    { id: 'artifact.openLatest', label: 'Open latest artifact externally', category: 'Artifacts', scope: 'global', defaultBinding: { key: 'o', alt: true, shift: true } },
    { id: 'pane.openPreview', label: 'Open or close preview pane', category: 'Artifacts', scope: 'global', defaultBinding: { key: 'v', alt: true, shift: true } },
    { id: 'pane.openFiles', label: 'Switch right pane to Files', category: 'Artifacts', scope: 'global', defaultBinding: { key: 'f', alt: true, shift: true } },
    { id: 'app.openSettings', label: 'Open settings', category: 'Navigation', scope: 'global', defaultBinding: { key: ',', alt: true, shift: true } },
    { id: 'app.showShortcuts', label: 'Show keyboard shortcuts', category: 'Accessibility', scope: 'global', defaultBinding: { key: '/', alt: true, shift: true } },
];

export const KEYBOARD_SHORTCUT_ACTION_BY_ID = Object.fromEntries(
    KEYBOARD_SHORTCUT_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<KeyboardShortcutActionId, KeyboardShortcutDefinition>;

const EDGE_RESERVED_SHORTCUTS = new Set([
    'ctrl+shift+b',
    'alt+shift+b',
    'ctrl+d',
    'ctrl+shift+d',
    'ctrl+shift+e',
    'alt+d',
    'ctrl+e',
    'alt+e',
    'ctrl+f',
    'alt+f',
    'ctrl+g',
    'ctrl+shift+g',
    'ctrl+h',
    'ctrl+shift+i',
    'alt+shift+i',
    'ctrl+j',
    'ctrl+k',
    'ctrl+shift+k',
    'ctrl+l',
    'ctrl+shift+l',
    'ctrl+m',
    'ctrl+shift+m',
    'ctrl+n',
    'ctrl+shift+n',
    'ctrl+o',
    'ctrl+shift+o',
    'ctrl+p',
    'ctrl+shift+p',
    'ctrl+r',
    'ctrl+shift+r',
    'ctrl+s',
    'ctrl+t',
    'ctrl+shift+t',
    'alt+shift+t',
    'ctrl+u',
    'ctrl+shift+u',
    'ctrl+shift+v',
    'ctrl+w',
    'ctrl+shift+w',
    'ctrl+shift+y',
    'ctrl+0',
    'ctrl+1',
    'ctrl+2',
    'ctrl+3',
    'ctrl+4',
    'ctrl+5',
    'ctrl+6',
    'ctrl+7',
    'ctrl+8',
    'ctrl+9',
    'ctrl+tab',
    'ctrl+shift+tab',
    'ctrl+pageup',
    'ctrl+pagedown',
    'ctrl++',
    'ctrl+-',
    'ctrl+shift+delete',
    'alt',
    'alt+arrowleft',
    'alt+arrowright',
    'alt+home',
    'alt+f4',
    'f1',
    'f3',
    'f4',
    'ctrl+f4',
    'f5',
    'shift+f5',
    'f6',
    'shift+f6',
    'ctrl+f6',
    'f7',
    'f9',
    'f10',
    'shift+f10',
    'f11',
    'f12',
    'escape',
    'tab',
    'shift+tab',
    ' ',
    'shift+ ',
    'pageup',
    'pagedown',
    'home',
    'end',
]);

const TEXT_EDITING_SHORTCUTS = new Set([
    'ctrl+a',
    'ctrl+b',
    'ctrl+c',
    'ctrl+i',
    'ctrl+u',
    'ctrl+v',
    'ctrl+x',
    'ctrl+y',
    'ctrl+z',
    'ctrl+backspace',
    'ctrl+delete',
    'ctrl+arrowleft',
    'ctrl+arrowright',
    'ctrl+arrowup',
    'ctrl+arrowdown',
    'ctrl+home',
    'ctrl+end',
]);

function normalizeKey(key: string): string {
    const lower = key.trim().toLowerCase();
    if (lower === 'esc') return 'escape';
    if (lower === 'up') return 'arrowup';
    if (lower === 'down') return 'arrowdown';
    if (lower === 'left') return 'arrowleft';
    if (lower === 'right') return 'arrowright';
    if (lower === 'return') return 'enter';
    if (lower === ' ') return ' ';
    return lower;
}

export function normalizeShortcut(binding: KeyboardShortcutBinding): KeyboardShortcutBinding {
    return {
        key: normalizeKey(binding.key),
        alt: !!binding.alt,
        shift: !!binding.shift,
        ctrl: !!binding.ctrl,
        meta: !!binding.meta,
    };
}

export function shortcutToKey(binding: KeyboardShortcutBinding): string {
    const normalized = normalizeShortcut(binding);
    return [
        normalized.ctrl ? 'ctrl' : null,
        normalized.meta ? 'meta' : null,
        normalized.alt ? 'alt' : null,
        normalized.shift ? 'shift' : null,
        normalized.key,
    ].filter(Boolean).join('+');
}

export function shortcutEquals(a: KeyboardShortcutBinding, b: KeyboardShortcutBinding): boolean {
    return shortcutToKey(a) === shortcutToKey(b);
}

export function formatShortcut(binding: KeyboardShortcutBinding | null | undefined): string {
    if (!binding) return 'Unassigned';
    const normalized = normalizeShortcut(binding);
    const keyLabel = normalized.key === 'arrowup' ? 'Up'
        : normalized.key === 'arrowdown' ? 'Down'
            : normalized.key === 'arrowleft' ? 'Left'
                : normalized.key === 'arrowright' ? 'Right'
                    : normalized.key === ' ' ? 'Space'
                        : normalized.key.length === 1 ? normalized.key.toUpperCase()
                            : normalized.key.charAt(0).toUpperCase() + normalized.key.slice(1);
    return [
        normalized.ctrl ? 'Ctrl' : null,
        normalized.meta ? 'Meta' : null,
        normalized.alt ? 'Alt' : null,
        normalized.shift ? 'Shift' : null,
        keyLabel,
    ].filter(Boolean).join('+');
}

export function eventToShortcutBinding(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>): KeyboardShortcutBinding {
    return normalizeShortcut({
        key: event.key,
        alt: event.altKey,
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
    });
}

export function shortcutFromReactKeyboardEvent(event: {
    key: string;
    altKey?: boolean;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
}): KeyboardShortcutBinding {
    return normalizeShortcut({
        key: event.key,
        alt: event.altKey,
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
    });
}

export function getShortcutBindingForAction(
    actionId: KeyboardShortcutActionId,
    overrides: KeyboardShortcutOverrides | null | undefined,
): KeyboardShortcutBinding | null {
    const override = overrides?.[actionId];
    if (override === null) return null;
    return normalizeShortcut(override ?? KEYBOARD_SHORTCUT_ACTION_BY_ID[actionId].defaultBinding);
}

export function findShortcutAction(
    binding: KeyboardShortcutBinding,
    overrides: KeyboardShortcutOverrides | null | undefined,
    scope: KeyboardShortcutScope,
): KeyboardShortcutDefinition | null {
    const key = shortcutToKey(binding);
    return KEYBOARD_SHORTCUT_DEFINITIONS.find((definition) => {
        if (definition.scope !== scope) return false;
        const active = getShortcutBindingForAction(definition.id, overrides);
        return active ? shortcutToKey(active) === key : false;
    }) ?? null;
}

export function isEdgeReservedShortcut(binding: KeyboardShortcutBinding): boolean {
    return EDGE_RESERVED_SHORTCUTS.has(shortcutToKey(binding));
}

export function isTextEditingShortcut(binding: KeyboardShortcutBinding): boolean {
    return TEXT_EDITING_SHORTCUTS.has(shortcutToKey(binding));
}

export function validateShortcutBinding(
    actionId: KeyboardShortcutActionId,
    binding: KeyboardShortcutBinding,
    overrides: KeyboardShortcutOverrides | null | undefined,
): { ok: true } | { ok: false; reason: string } {
    const normalized = normalizeShortcut(binding);
    if (!normalized.ctrl && !normalized.meta && !normalized.alt) {
        return { ok: false, reason: 'Use Ctrl, Alt, or Meta with the key.' };
    }
    if (isEdgeReservedShortcut(normalized)) {
        return { ok: false, reason: `${formatShortcut(normalized)} is reserved by Microsoft Edge.` };
    }
    if (isTextEditingShortcut(normalized)) {
        return { ok: false, reason: `${formatShortcut(normalized)} is a common text editing shortcut.` };
    }
    const key = shortcutToKey(normalized);
    const conflict = KEYBOARD_SHORTCUT_DEFINITIONS.find((definition) => {
        if (definition.id === actionId) return false;
        const other = getShortcutBindingForAction(definition.id, overrides);
        return other ? shortcutToKey(other) === key : false;
    });
    if (conflict) {
        return { ok: false, reason: `${formatShortcut(normalized)} is already used for ${conflict.label}.` };
    }
    return { ok: true };
}
