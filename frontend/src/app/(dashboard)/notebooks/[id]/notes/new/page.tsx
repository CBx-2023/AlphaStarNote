'use client'

import { useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, PenTool, Bot, GraduationCap } from 'lucide-react'
import { useCreateNote } from '@/lib/hooks/use-notes'
import { useTranslation } from '@/lib/hooks/use-translation'
import { MarkdownEditor, MarkdownEditorRef } from '@/components/ui/markdown-editor'
import { DrawioEditor } from '@/components/ui/drawio-editor'
import { ResizablePanel, type SplitDirection } from '@/components/ui/resizable-panel'
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog'
import { KeyboardShortcuts } from '@/components/common/KeyboardShortcuts'
import { AppShell } from '@/components/layout/AppShell'
import { ChatColumn } from '@/app/(dashboard)/notebooks/components/ChatColumn'
import { InteractiveClassroomPanel } from '@/components/notebooks/InteractiveClassroomPanel'
import { InteractiveClassroomSummaryDialog } from '@/components/notebooks/InteractiveClassroomSummaryDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useInteractiveClassroom } from '@/lib/hooks/use-interactive-classroom'
import { embedDrawioXml } from '@/lib/utils/drawio'

type PanelMode = 'none' | 'drawio' | 'chat' | 'interactiveClassroom'

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
    const [activePanel, setActivePanel] = useState<PanelMode>('none')
    const [splitDirection, setSplitDirection] = useState<SplitDirection>('vertical')
    const [drawioXml, setDrawioXml] = useState('')
    const editorRef = useRef<MarkdownEditorRef>(null)

    // Default context selections for ChatColumn
    const defaultContextSelections = { sources: {} as Record<string, 'off' | 'insights' | 'full'>, notes: {} as Record<string, 'off' | 'insights' | 'full'> }
    const {
        copy: interactiveCopy,
        hasSendableContent,
        hasSession: hasInteractiveClassroomSession,
        iframeKey,
        isCreatingJob,
        isGeneratingSummary,
        isSummaryDialogOpen,
        interactiveClassroomEmbedState,
        interactiveClassroomJob,
        interactiveClassroomUrl,
        markEmbedLoaded,
        openInNewTab,
        retryEmbed,
        setIsSummaryDialogOpen,
        setSummaryDraft,
        startSummaryGeneration,
        submitSummary,
        summaryDraft,
    } = useInteractiveClassroom({ title, content })

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
    }, [title, content, drawioXml, notebookId, createNoteMutation, router])

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

    const handleInteractiveClassroomClick = useCallback(async () => {
        if (activePanel !== 'interactiveClassroom' && hasInteractiveClassroomSession) {
            setActivePanel('interactiveClassroom')
            return
        }

        setActivePanel('interactiveClassroom')
        await startSummaryGeneration()
    }, [activePanel, hasInteractiveClassroomSession, startSummaryGeneration])

    const renderEditor = () => (
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
    )

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
                            variant={activePanel === 'drawio' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setActivePanel((currentPanel) => currentPanel === 'drawio' ? 'none' : 'drawio')}
                            title="绘图"
                        >
                            <PenTool className="mr-1 h-4 w-4" />
                            绘图
                        </Button>
                        <Button
                            variant={activePanel === 'chat' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => setActivePanel((currentPanel) => currentPanel === 'chat' ? 'none' : 'chat')}
                            title="AI 对话"
                        >
                            <Bot className="mr-1 h-4 w-4" />
                            AI
                        </Button>
                        <Button
                            variant={activePanel === 'interactiveClassroom' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => void handleInteractiveClassroomClick()}
                            disabled={(!hasSendableContent && !hasInteractiveClassroomSession) || isGeneratingSummary || isCreatingJob}
                            title={interactiveCopy.buttonTitle}
                        >
                            <GraduationCap className="mr-1 h-4 w-4" />
                            {interactiveCopy.buttonLabel}
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
                    {activePanel === 'drawio' ? (
                        <ResizablePanel
                            key={activePanel}
                            direction={splitDirection}
                            onDirectionChange={setSplitDirection}
                            className="h-full"
                            first={renderEditor()}
                            second={
                                <DrawioEditor
                                    initialXml={drawioXml}
                                    onSave={(xml) => setDrawioXml(xml)}
                                    onExit={() => setActivePanel('none')}
                                    className="h-full"
                                />
                            }
                        />
                    ) : activePanel === 'chat' ? (
                        <ResizablePanel
                            key={activePanel}
                            direction={splitDirection}
                            onDirectionChange={setSplitDirection}
                            className="h-full"
                            defaultRatio={0.6}
                            first={renderEditor()}
                            second={
                                <div className="h-full overflow-hidden">
                                    <ChatColumn
                                        notebookId={notebookId}
                                        contextSelections={defaultContextSelections}
                                    />
                                </div>
                            }
                        />
                    ) : activePanel === 'interactiveClassroom' ? (
                        <ResizablePanel
                            key={activePanel}
                            direction={splitDirection}
                            onDirectionChange={setSplitDirection}
                            className="h-full"
                            defaultRatio={0.55}
                            first={renderEditor()}
                            second={
                                <div className="h-full overflow-hidden">
                                    <InteractiveClassroomPanel
                                        copy={interactiveCopy}
                                        iframeKey={iframeKey}
                                        job={interactiveClassroomJob}
                                        url={interactiveClassroomUrl}
                                        embedState={interactiveClassroomEmbedState}
                                        onClose={() => setActivePanel('none')}
                                        onIframeLoad={markEmbedLoaded}
                                        onOpenInNewTab={openInNewTab}
                                        onReload={retryEmbed}
                                        onRetryEmbed={retryEmbed}
                                    />
                                </div>
                            }
                        />
                    ) : (
                        renderEditor()
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

            <InteractiveClassroomSummaryDialog
                open={isSummaryDialogOpen}
                summary={summaryDraft}
                isGeneratingSummary={isGeneratingSummary}
                isSubmitting={isCreatingJob}
                copy={interactiveCopy}
                onOpenChange={(open) => {
                    if (!isGeneratingSummary && !isCreatingJob) {
                        setIsSummaryDialogOpen(open)
                    }
                }}
                onSummaryChange={setSummaryDraft}
                onSubmit={() => void submitSummary()}
            />
        </AppShell>
    )
}
