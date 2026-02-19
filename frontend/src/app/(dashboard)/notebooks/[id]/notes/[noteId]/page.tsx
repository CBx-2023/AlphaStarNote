'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Check } from 'lucide-react'
import { useNote, useUpdateNote, useDeleteNote } from '@/lib/hooks/use-notes'
import { notesApi } from '@/lib/api/notes'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useAutoSave } from '@/lib/hooks/use-auto-save'
import { MarkdownEditor, MarkdownEditorRef } from '@/components/ui/markdown-editor'
import { InlineEdit } from '@/components/common/InlineEdit'
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { KeyboardShortcuts } from '@/components/common/KeyboardShortcuts'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export default function EditNotePage() {
    const params = useParams<{ id: string; noteId: string }>()
    const router = useRouter()
    const { t } = useTranslation()
    const notebookId = params.id ? decodeURIComponent(params.id as string) : ''
    const noteId = params.noteId ? decodeURIComponent(params.noteId as string) : ''

    const { data: note, isLoading } = useNote(noteId)
    const updateNoteMutation = useUpdateNote()
    const deleteNoteMutation = useDeleteNote()

    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [isInitialized, setIsInitialized] = useState(false)
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
    const editorRef = useRef<MarkdownEditorRef>(null)

    // Initialize editor with note data
    useEffect(() => {
        if (note && !isInitialized) {
            setTitle(note.title ?? '')
            setContent(note.content ?? '')
            setIsInitialized(true)
        }
    }, [note, isInitialized])

    // Silent save for auto-save (no toast)
    const performSave = useCallback(async () => {
        if (!noteId) return
        await notesApi.update(noteId, {
            title: title || undefined,
            content: content || undefined,
        })
    }, [noteId, title, content])

    // Auto-save hook
    const { isDirty, isSaving, lastSavedAt, save, markSaved } = useAutoSave({
        onSave: performSave,
        data: JSON.stringify({ title, content }),
        interval: 10000,
        enabled: isInitialized,
    })

    // Manual save with toast feedback
    const handleManualSave = useCallback(async () => {
        if (!noteId) return
        await updateNoteMutation.mutateAsync({
            id: noteId,
            data: {
                title: title || undefined,
                content: content || undefined,
            },
        })
        markSaved()
    }, [noteId, title, content, updateNoteMutation, markSaved])

    // Mark as saved once note data loads
    useEffect(() => {
        if (isInitialized) {
            markSaved()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isInitialized])

    // Browser beforeunload guard
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault()
            }
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [isDirty])

    const navigateBack = useCallback(() => {
        router.push(`/notebooks/${notebookId}`)
    }, [router, notebookId])

    const handleBack = useCallback(() => {
        if (isDirty) {
            setPendingNavigation(`/notebooks/${notebookId}`)
            setShowUnsavedDialog(true)
        } else {
            navigateBack()
        }
    }, [isDirty, navigateBack, notebookId])

    const handleSaveAndLeave = useCallback(async () => {
        await save()
        setShowUnsavedDialog(false)
        if (pendingNavigation) {
            router.push(pendingNavigation)
        }
    }, [save, pendingNavigation, router])

    const handleDiscard = useCallback(() => {
        setShowUnsavedDialog(false)
        if (pendingNavigation) {
            router.push(pendingNavigation)
        }
    }, [pendingNavigation, router])

    const handleDelete = useCallback(async () => {
        if (!noteId) return
        await deleteNoteMutation.mutateAsync(noteId)
        setShowDeleteDialog(false)
        navigateBack()
    }, [noteId, deleteNoteMutation, navigateBack])

    if (isLoading) {
        return (
            <AppShell>
                <div className="flex items-center justify-center h-full">
                    <LoadingSpinner size="lg" />
                </div>
            </AppShell>
        )
    }

    if (!note) {
        return (
            <AppShell>
                <div className="flex flex-col items-center justify-center h-full gap-4">
                    <p className="text-muted-foreground">{t.common.itemNotFound.replace('{type}', t.common.note)}</p>
                    <Button variant="outline" onClick={navigateBack}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t.common.backToNotebook}
                    </Button>
                </div>
            </AppShell>
        )
    }

    return (
        <AppShell>
            <div className="flex flex-col h-full">
                {/* Header bar */}
                <div className="flex items-center justify-between border-b px-6 py-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={handleBack}>
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            {t.common.backToNotebook}
                        </Button>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Auto-save status */}
                        {isSaving && (
                            <span className="text-xs text-muted-foreground animate-pulse">
                                {t.common.saving}
                            </span>
                        )}
                        {!isSaving && lastSavedAt && !isDirty && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Check className="h-3 w-3 text-green-500" />
                                {t.common.autoSaved}
                            </span>
                        )}
                        <Button
                            size="sm"
                            onClick={() => handleManualSave()}
                            disabled={!isDirty || isSaving}
                        >
                            <Save className="mr-1 h-4 w-4" />
                            {t.common.save}
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteDialog(true)}
                        >
                            {t.common.delete}
                        </Button>
                    </div>
                </div>

                {/* Keyboard shortcuts */}
                <KeyboardShortcuts />

                {/* Title and metadata */}
                <div className="px-6 pt-4 pb-2 shrink-0">
                    <InlineEdit
                        value={title}
                        onSave={(v) => setTitle(v)}
                        placeholder={t.sources.addTitle}
                        className="text-2xl font-bold"
                    />
                    <div className="flex items-center gap-2 mt-2">
                        {note.note_type && (
                            <Badge variant={note.note_type === 'ai' ? 'default' : 'secondary'}>
                                {note.note_type === 'ai' ? t.common.aiGenerated : t.common.human}
                            </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                            {t.common.updated.replace('{time}', new Date(note.updated).toLocaleString())}
                        </span>
                    </div>
                </div>

                {/* Editor — only render after data is loaded, because
                    Milkdown reads value only on initial mount */}
                <div className="flex-1 overflow-hidden px-6 pb-6">
                    {isInitialized ? (
                        <MarkdownEditor
                            ref={editorRef}
                            key={noteId}
                            value={content}
                            onChange={(v) => setContent(v ?? '')}
                            placeholder={t.sources.writeNotePlaceholder}
                            height={500}
                            className="h-full [&_.milkdown-editor-wrapper]:h-full"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <LoadingSpinner />
                        </div>
                    )}
                </div>
            </div>

            {/* Unsaved changes dialog */}
            <UnsavedChangesDialog
                open={showUnsavedDialog}
                onOpenChange={setShowUnsavedDialog}
                onSaveAndLeave={handleSaveAndLeave}
                onDiscard={handleDiscard}
                isSaving={isSaving}
            />

            {/* Delete confirmation dialog */}
            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title={t.notebooks.deleteNote}
                description={t.notebooks.deleteNoteConfirm}
                confirmVariant="destructive"
                onConfirm={handleDelete}
                isLoading={deleteNoteMutation.isPending}
            />
        </AppShell>
    )
}
