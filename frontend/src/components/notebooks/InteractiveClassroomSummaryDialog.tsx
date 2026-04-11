'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { getInteractiveClassroomCopy } from '@/lib/interactive-classroom'

interface InteractiveClassroomSummaryDialogProps {
  open: boolean
  summary: string
  isGeneratingSummary: boolean
  isSubmitting: boolean
  copy: ReturnType<typeof getInteractiveClassroomCopy>
  onOpenChange: (open: boolean) => void
  onSummaryChange: (summary: string) => void
  onSubmit: () => void
}

export function InteractiveClassroomSummaryDialog({
  open,
  summary,
  isGeneratingSummary,
  isSubmitting,
  copy,
  onOpenChange,
  onSummaryChange,
  onSubmit,
}: InteractiveClassroomSummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{copy.summaryTitle}</DialogTitle>
          <DialogDescription>{copy.summaryDescription}</DialogDescription>
        </DialogHeader>

        {isGeneratingSummary ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-sm text-muted-foreground">
            <LoadingSpinner />
            <span>{copy.generatingSummary}</span>
          </div>
        ) : (
          <Textarea
            value={summary}
            onChange={(event) => onSummaryChange(event.target.value)}
            placeholder={copy.summaryPlaceholder}
            className="min-h-72 resize-y"
          />
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGeneratingSummary || isSubmitting}
          >
            {copy.cancel}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isGeneratingSummary || isSubmitting || !summary.trim()}
          >
            {isSubmitting ? copy.preparingJob : copy.submitSummary}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
