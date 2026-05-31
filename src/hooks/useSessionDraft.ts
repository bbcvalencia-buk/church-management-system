import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Persists form draft state in localStorage so it survives tab switches / navigation
 * and survives browser crashes or mobile OS background suspension.
 *
 * Usage:
 *   const [form, setForm, clearDraft] = useSessionDraft('service-form', INITIAL_STATE);
 *
 * - `form`       — current state (restored from local storage on mount)
 * - `setForm`    — works like a normal setState
 * - `clearDraft` — call after successful save to wipe draft
 */
export function useSessionDraft<T>(
    key: string,
    initialState: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
    const storageKey = `draft:${key}`;
    const isInitialMount = useRef(true);

    // On mount: try to restore from localStorage, else use initialState
    const [state, setState] = useState<T>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
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

    // Persist to localStorage on every state change (skip initial mount to avoid writing initialState)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (e) {
            console.warn(`[useSessionDraft] Failed to save draft "${key}":`, e);
        }
    }, [state, storageKey]);

    // Clear draft — call this on successful form submission
    const clearDraft = useCallback(() => {
        localStorage.removeItem(storageKey);
        setState(initialState);
    }, [storageKey, initialState]);

    return [state, setState, clearDraft];
}

/**
 * Persists a simple value (like a selected member or list of IDs) in localStorage.
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
            const saved = localStorage.getItem(storageKey);
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
            localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (e) { /* ignore */ }
    }, [value, storageKey]);

    const clear = useCallback(() => {
        localStorage.removeItem(storageKey);
        setValue(initialValue);
    }, [storageKey, initialValue]);

    return [value, setValue, clear];
}

