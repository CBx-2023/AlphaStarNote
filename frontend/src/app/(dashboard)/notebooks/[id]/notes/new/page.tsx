'use client'

import { useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, PenTool } from 'lucide-react'
import { useCreateNote } from '@/lib/hooks/use-notes'
import { useTranslation } from '@/lib/hooks/use-translation'
import { MarkdownEditor, MarkdownEditorRef } from '@/components/ui/markdown-editor'
import { DrawioEditor } from '@/components/ui/drawio-editor'
import { ResizablePanel, type SplitDirection } from '@/components/ui/resizable-panel'
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog'
import { KeyboardShortcuts } from '@/components/common/KeyboardShortcuts'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { embedDrawioXml } from '@/lib/utils/drawio'

export default function NewNotePage() {
    const params = useParams<{ id: string }>()
    const router = useRouter()
    const { t } = useTranslation()
    const notebookId = params.id ? decodeURIComponent(params.id as string) : ''

    const createNoteMutation = useCreateNote()

    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
    const [showDrawio, setShowDrawio] = useState(false)
    const [splitDirection, setSplitDirection] = useState<SplitDirection>('vertical')
    const [drawioXml, setDrawioXml] = useState('')
    const editorRef = useRef<MarkdownEditorRef>(null)

    const isDirty = title.trim() !== '' || content.trim() !== '' || drawioXml !== ''

    const handleSave = useCallback(async () => {
        if (!content.trim()) return

        setIsSaving(true)
        try {
            const result = await createNoteMutation.mutateAsync({
                title: title || undefined,
                content: drawioXml ? embedDrawioXml(content, drawioXml) : content,
                note_type: 'human',
                notebook_id: notebookId,
            })
            // Navigate to the edit page for the newly created note
            router.replace(`/notebooks/${notebookId}/notes/${result.id}`)
        } catch {
            // Error toast handled by the mutation hook
        } finally {
            setIsSaving(false)
        }
    }, [title, content, notebookId, createNoteMutation, router])

    const navigateBack = useCallback(() => {
        router.push(`/notebooks/${notebookId}`)
    }, [router, notebookId])

    const handleBack = useCallback(() => {
        if (isDirty) {
            setShowUnsavedDialog(true)
        } else {
            navigateBack()
        }
    }, [isDirty, navigateBack])

    const handleSaveAndLeave = useCallback(async () => {
        if (content.trim()) {
            await handleSave()
        }
        setShowUnsavedDialog(false)
    }, [content, handleSave])

    const handleDiscard = useCallback(() => {
        setShowUnsavedDialog(false)
        navigateBack()
    }, [navigateBack])

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
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={!content.trim() || isSaving}
                        >
                            <Save className="mr-1 h-4 w-4" />
                            {isSaving ? t.common.saving : t.sources.createNoteBtn}
                        </Button>
                        <Button
                            variant={showDrawio ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setShowDrawio(!showDrawio)}
                            title="绘图"
                        >
                            <PenTool className="mr-1 h-4 w-4" />
                            绘图
                        </Button>
                    </div>
                </div>

                {/* Keyboard shortcuts */}
                <KeyboardShortcuts />

                {/* Title */}
                <div className="px-6 pt-4 pb-2 shrink-0">
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t.sources.addTitle}
                        className="text-2xl font-bold border-none shadow-none focus-visible:ring-0 px-0 h-auto"
                    />
                </div>

                {/* Editor */}
                <div className="flex-1 overflow-hidden">
                    {showDrawio ? (
                        <ResizablePanel
                            direction={splitDirection}
                            onDirectionChange={setSplitDirection}
                            className="h-full"
                            first={
                                <div className="h-full px-6 pb-4">
                                    <MarkdownEditor
                                        ref={editorRef}
                                        value={content}
                                        onChange={(v) => setContent(v ?? '')}
                                        placeholder={t.sources.writeNotePlaceholder}
                                        height={500}
                                        className="h-full [&_.milkdown-editor-wrapper]:h-full"
                                    />
                                </div>
                            }
                            second={
                                <DrawioEditor
                                    initialXml={drawioXml}
                                    onSave={(xml) => setDrawioXml(xml)}
                                    onExit={() => setShowDrawio(false)}
                                    className="h-full"
                                />
                            }
                        />
                    ) : (
                        <div className="h-full px-6 pb-6">
                            <MarkdownEditor
                                ref={editorRef}
                                value={content}
                                onChange={(v) => setContent(v ?? '')}
                                placeholder={t.sources.writeNotePlaceholder}
                                height={500}
                                className="h-full [&_.milkdown-editor-wrapper]:h-full"
                            />
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
        </AppShell>
    )
}
