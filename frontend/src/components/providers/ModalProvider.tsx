'use client'

import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { SourceInsightDialog } from '@/components/source/SourceInsightDialog'
import { SourceDialog } from '@/components/source/SourceDialog'

/**
 * Modal Provider Component
 *
 * Renders modals based on URL query parameters (?modal=type&id=xxx)
 * Manages modal state through the useModalManager hook
 *
 * Supported modal types:
 * - source: Source detail modal
 * - insight: Source insight modal
 *
 * Note: Note editing has been moved to dedicated pages
 * (/notebooks/[id]/notes/[noteId] and /notebooks/[id]/notes/new)
 */
export function ModalProvider() {
  const { modalType, modalId, closeModal } = useModalManager()

  return (
    <>
      {/* Source Modal */}
      <SourceDialog
        open={modalType === 'source'}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
        sourceId={modalId}
      />

      {/* Source Insight Modal */}
      <SourceInsightDialog
        open={modalType === 'insight'}
        onOpenChange={(open) => {
          if (!open) closeModal()
        }}
        insight={modalId ? { id: modalId, insight_type: '', content: '' } : undefined}
      />
    </>
  )
}
