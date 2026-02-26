import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Persists form draft state in sessionStorage so it survives tab switches / navigation
 * but is cleared when the browser session ends.
 *
 * Usage:
 *   const [form, setForm, clearDraft] = useSessionDraft('service-form', INITIAL_STATE);
 *
 * - `form`       — current state (restored from session on mount)
 * - `setForm`    — works like a normal setState
 * - `clearDraft` — call after successful save to wipe draft
 */
export function useSessionDraft<T>(
    key: string,
    initialState: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
    const storageKey = `draft:${key}`;
    const isInitialMount = useRef(true);

    // On mount: try to restore from sessionStorage, else use initialState
    const [state, setState] = useState<T>(() => {
        try {
            const saved = sessionStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with initialState to handle any new fields added since draft was saved
                return { ...initialState, ...parsed };
            }
        } catch (e) {
            console.warn(`[useSessionDraft] Failed to restore draft "${key}":`, e);
        }
        return initialState;
    });

    // Persist to sessionStorage on every state change (skip initial mount to avoid writing initialState)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(state));
        } catch (e) {
            console.warn(`[useSessionDraft] Failed to save draft "${key}":`, e);
        }
    }, [state, storageKey]);

    // Clear draft — call this on successful form submission
    const clearDraft = useCallback(() => {
        sessionStorage.removeItem(storageKey);
        setState(initialState);
    }, [storageKey, initialState]);

    return [state, setState, clearDraft];
}

/**
 * Persists a simple value (like a selected member or list of IDs) in sessionStorage.
 * Same idea as useSessionDraft but for non-form values.
 */
export function useSessionValue<T>(
    key: string,
    initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
    const storageKey = `draft-val:${key}`;
    const isInitialMount = useRef(true);

    const [value, setValue] = useState<T>(() => {
        try {
            const saved = sessionStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return initialValue;
    });

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(value));
        } catch (e) { /* ignore */ }
    }, [value, storageKey]);

    const clear = useCallback(() => {
        sessionStorage.removeItem(storageKey);
        setValue(initialValue);
    }, [storageKey, initialValue]);

    return [value, setValue, clear];
}
