import { FileJson, FileText, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

type EmptyStateProps = {
  onNewPlan?: () => void
  onOpenPlan?: () => void
}

/** Shown in every section until a plan is generated or opened. */
export function EmptyState({ onNewPlan, onOpenPlan }: EmptyStateProps) {
  return (
    <section
      aria-labelledby="empty-title"
      className="flex flex-col items-start gap-6 rounded-2xl border border-border bg-card p-8 sm:p-12"
    >
      <span className="grid size-12 place-items-center rounded-xl bg-accent text-label" aria-hidden="true">
        <FileText className="size-6" />
      </span>
      <div className="flex max-w-xl flex-col gap-2">
        <p className="eyebrow">Get started</p>
        <h1 id="empty-title" className="font-heading text-3xl font-extrabold tracking-tight text-heading">
          No plan yet
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Upload a statement of work and Claude builds the phases, sprints and risks, or reopen a plan.json you
          exported earlier.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onNewPlan} disabled={!onNewPlan}>
          <Plus data-icon="inline-start" />
          New plan from a SOW
        </Button>
        <Button size="lg" variant="outline" onClick={onOpenPlan} disabled={!onOpenPlan}>
          <FileJson data-icon="inline-start" />
          Open plan.json
        </Button>
      </div>
    </section>
  )
}
