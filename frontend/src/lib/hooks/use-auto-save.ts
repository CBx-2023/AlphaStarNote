'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAutoSaveOptions {
    /** Async save function */
    onSave: () => Promise<void>
    /** Data to watch for changes */
    data: string
    /** Auto-save interval in milliseconds (default: 10000 = 10s) */
    interval?: number
    /** Whether auto-save is enabled (default: true) */
    enabled?: boolean
}

interface UseAutoSaveReturn {
    /** Whether there are unsaved changes */
    isDirty: boolean
    /** Whether a save is currently in progress */
    isSaving: boolean
    /** Timestamp of the last successful save */
    lastSavedAt: Date | null
    /** Trigger a manual save and reset the auto-save timer */
    save: () => Promise<void>
    /** Mark current state as saved (e.g. after initial load) */
    markSaved: () => void
}

export function useAutoSave({
    onSave,
    data,
    interval = 10000,
    enabled = true,
}: UseAutoSaveOptions): UseAutoSaveReturn {
    const [isDirty, setIsDirty] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

    const savedDataRef = useRef(data)
    const onSaveRef = useRef(onSave)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Keep refs up to date
    onSaveRef.current = onSave

    // Track dirty state by comparing current data to last saved data
    useEffect(() => {
        const dirty = data !== savedDataRef.current
        setIsDirty(dirty)
    }, [data])

    const performSave = useCallback(async () => {
        if (isSaving) return

        setIsSaving(true)
        try {
            await onSaveRef.current()
            savedDataRef.current = data
            setIsDirty(false)
            setLastSavedAt(new Date())
        } catch (error) {
            console.error('Auto-save failed:', error)
        } finally {
            setIsSaving(false)
        }
    }, [data, isSaving])

    const save = useCallback(async () => {
        await performSave()
        // Reset the auto-save timer after manual save
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }
        if (enabled) {
            intervalRef.current = setInterval(() => {
                // Check dirty state via ref comparison at trigger time
                performSave()
            }, interval)
        }
    }, [performSave, interval, enabled])

    const markSaved = useCallback(() => {
        savedDataRef.current = data
        setIsDirty(false)
    }, [data])

    // Set up auto-save interval
    useEffect(() => {
        if (!enabled) return

        intervalRef.current = setInterval(() => {
            performSave()
        }, interval)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [enabled, interval, performSave])

    return { isDirty, isSaving, lastSavedAt, save, markSaved }
}
