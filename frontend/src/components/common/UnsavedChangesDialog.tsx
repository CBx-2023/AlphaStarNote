'use client'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/hooks/use-translation'

interface UnsavedChangesDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaveAndLeave: () => void
    onDiscard: () => void
    isSaving?: boolean
}

export function UnsavedChangesDialog({
    open,
    onOpenChange,
    onSaveAndLeave,
    onDiscard,
    isSaving = false,
}: UnsavedChangesDialogProps) {
    const { t } = useTranslation()

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {t.common.unsavedChanges || 'Unsaved Changes'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {t.common.unsavedChangesDesc || 'You have unsaved changes. What would you like to do?'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex gap-2 sm:gap-0">
                    <AlertDialogCancel disabled={isSaving}>
                        {t.common.cancel}
                    </AlertDialogCancel>
                    <Button
                        variant="destructive"
                        onClick={onDiscard}
                        disabled={isSaving}
                    >
                        {t.common.discard || 'Discard'}
                    </Button>
                    <AlertDialogAction
                        onClick={onSaveAndLeave}
                        disabled={isSaving}
                    >
                        {isSaving
                            ? `${t.common.saving || 'Saving'}...`
                            : (t.common.saveAndLeave || 'Save & Leave')
                        }
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
