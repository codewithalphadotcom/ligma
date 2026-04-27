/**
 * Robust Y.Text ↔ HTMLTextAreaElement two-way binding.
 *
 * Strategy:
 *   - Local input  → diff old vs new value, find common prefix/suffix, apply
 *                     a single Y.Text delete+insert in one transaction.
 *   - Remote update → recompute textarea value from Y.Text, preserving caret
 *                     position by adjusting it relative to the diff offset.
 *
 * This avoids the naive `ytext.delete(0, len); ytext.insert(0, value)` pattern
 * which destroys CRDT history and breaks concurrent editing semantics.
 */

import type * as Y from 'yjs';

/** Compute [prefixLen, suffixLen] of two strings. */
function diffEdges(a: string, b: string): { prefix: number; suffix: number } {
    const minLen = Math.min(a.length, b.length);
    let prefix = 0;
    while (prefix < minLen && a.charCodeAt(prefix) === b.charCodeAt(prefix)) {
        prefix++;
    }
    let suffix = 0;
    const maxSuffix = minLen - prefix;
    while (
        suffix < maxSuffix &&
        a.charCodeAt(a.length - 1 - suffix) === b.charCodeAt(b.length - 1 - suffix)
    ) {
        suffix++;
    }
    return { prefix, suffix };
}

/** Adjust a caret position when text changes around it. */
function adjustCaret(oldVal: string, newVal: string, caret: number): number {
    const { prefix } = diffEdges(oldVal, newVal);
    if (caret <= prefix) return caret;
    // Caret was after the changed region — shift by the length delta.
    const delta = newVal.length - oldVal.length;
    const adjusted = caret + delta;
    // Clamp.
    if (adjusted < prefix) return prefix;
    if (adjusted > newVal.length) return newVal.length;
    return adjusted;
}

export interface TextareaBinding {
    destroy: () => void;
}

export function bindYTextToTextarea(
    ytext: Y.Text,
    textarea: HTMLTextAreaElement,
): TextareaBinding {
    // Initial sync.
    let lastValue = ytext.toString();
    textarea.value = lastValue;

    let applyingRemote = false;

    const onYUpdate = (_event: Y.YTextEvent, transaction: Y.Transaction) => {
        // Skip echoes from our own local edits — Y emits events for local txns too.
        if (transaction.local) {
            lastValue = ytext.toString();
            return;
        }
        const remoteValue = ytext.toString();
        if (remoteValue === textarea.value) {
            lastValue = remoteValue;
            return;
        }
        const oldValue = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        applyingRemote = true;
        textarea.value = remoteValue;
        applyingRemote = false;

        // Restore caret intelligently.
        const newStart = adjustCaret(oldValue, remoteValue, start);
        const newEnd = adjustCaret(oldValue, remoteValue, end);
        try {
            textarea.setSelectionRange(newStart, newEnd);
        } catch {
            /* element may not currently support selection — ignore */
        }
        lastValue = remoteValue;
    };

    ytext.observe(onYUpdate);

    const onInput = () => {
        if (applyingRemote) return;
        const newValue = textarea.value;
        if (newValue === lastValue) return;

        const oldValue = lastValue;
        const { prefix, suffix } = diffEdges(oldValue, newValue);
        const deleteLen = oldValue.length - prefix - suffix;
        const insertText = newValue.slice(prefix, newValue.length - suffix);

        const doc = ytext.doc;
        const apply = () => {
            if (deleteLen > 0) ytext.delete(prefix, deleteLen);
            if (insertText.length > 0) ytext.insert(prefix, insertText);
        };
        if (doc) {
            doc.transact(apply, 'textarea-binding');
        } else {
            apply();
        }
        lastValue = newValue;
    };

    textarea.addEventListener('input', onInput);

    return {
        destroy() {
            ytext.unobserve(onYUpdate);
            textarea.removeEventListener('input', onInput);
        },
    };
}
