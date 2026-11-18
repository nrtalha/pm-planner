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

type ReplacePlanDialogProps = {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Asked before a new or reopened plan replaces one that has unsaved edits. */
export function ReplacePlanDialog({ open, onCancel, onConfirm }: ReplacePlanDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace the current plan?</AlertDialogTitle>
          <AlertDialogDescription>
            You have edited this plan. Loading another one discards those edits. Export the files you need first if
            you want to keep them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Discard edits
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
