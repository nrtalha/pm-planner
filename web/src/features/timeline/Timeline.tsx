import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormError } from '@/features/plan/FormError'
import { ApiError, reconcileSchedule } from '@/lib/api'
import { nextWeekday } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { newRowId } from '@/lib/ids'
import { buildGantt } from '@/lib/gantt'
import type { PhaseRow, PlanState } from '@/lib/types'

import { GanttChart } from './GanttChart'
import { PhaseTable } from './PhaseTable'

type TimelineProps = {
  state: PlanState
  onChange: (next: PlanState) => void
}

export function Timeline({ state, onChange }: TimelineProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { phases, status, project } = state

  const gantt = useMemo(
    () => buildGantt(phases, state.start_date, status.deadline),
    [phases, state.start_date, status.deadline],
  )
  const colorOf = (phase: string | null) => {
    const name = phase?.trim() || 'Uncategorized'
    return gantt?.legend.find((l) => l.phase === name)?.colorIndex
  }

  /** Send the edit to the API (all date rules live in Python) and apply the result. */
  const apply = async (edited: PhaseRow[], startDate = state.start_date) => {
    setPending(true)
    setError(null)
    try {
      const result = await reconcileSchedule({
        startDate,
        agreedWeeks: project.agreed_timeline_weeks,
        previous: phases,
        edited,
      })
      onChange({ ...state, start_date: startDate, phases: result.phases, status: result.status })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The schedule could not be updated.')
    } finally {
      setPending(false)
    }
  }

  const onEdit = (id: string, patch: Partial<PhaseRow>) =>
    apply(phases.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const onAdd = () => {
    const lastEnd = phases.map((p) => p.end_date).filter(Boolean).sort().at(-1)
    apply([
      ...phases,
      {
        id: newRowId(),
        order: null,
        task_name: 'New phase',
        phase: null,
        duration_weeks: 1,
        start_date: lastEnd ? nextWeekday(lastEnd) : state.start_date,
        end_date: null,
      },
    ])
  }

  const onDelete = (id: string) => apply(phases.filter((p) => p.id !== id))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Timeline</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            Phase schedule
          </h1>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="project-start">Project start date</Label>
          <Input
            id="project-start"
            type="date"
            className="w-48"
            value={state.start_date}
            disabled={pending}
            aria-describedby="project-start-hint"
            onChange={(event) => {
              if (event.target.value) apply(phases, event.target.value)
            }}
          />
          <p id="project-start-hint" className="max-w-56 text-xs text-muted-foreground">
            Moves the deadline. Phase dates stay as they are.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {status.on_track ? (
          <p className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm text-success">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>On track.</strong> Deliverables finish within the {project.agreed_timeline_weeks}-week contract,
              by {formatDate(status.deadline)}.
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            <span>
              <strong>Deadline breach.</strong> Phases run to {formatDate(status.latest_end)}, past the{' '}
              {formatDate(status.deadline)} deadline.
            </span>
          </p>
        )}
        <span role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground">
          {pending && (
            <>
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              Updating schedule…
            </>
          )}
        </span>
      </div>

      <FormError message={error} />

      <PhaseTable
        phases={phases}
        colorOf={colorOf}
        disabled={pending}
        onEdit={onEdit}
        onAdd={onAdd}
        onDelete={onDelete}
      />
      <GanttChart gantt={gantt} deadline={status.deadline} />
    </div>
  )
}
