import { CircleCheck, Download, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormError } from '@/features/plan/FormError'
import { ApiError, downloadExport, downloadGanttPng, GANTT_PNG, type ExportKind } from '@/lib/api'
import type { LoadedPlan } from '@/lib/types'
import { cn } from '@/lib/utils'

type ExportId = ExportKind | 'png'

type ExportItem = {
  id: ExportId
  format: string
  title: string
  description: string
  filename: string
  /** Needs at least one phase with dates (Excel, PowerPoint, PNG). */
  chart?: boolean
}

const ITEMS: ExportItem[] = [
  {
    id: 'plan-json',
    format: 'JSON',
    title: 'Saved plan',
    description: 'Everything on screen, edits included. Reopen it later with Open plan.json.',
    filename: 'plan.json',
  },
  {
    id: 'phase-csv',
    format: 'CSV',
    title: 'Phase schedule',
    description: 'Order, task, phase, duration and dates for each phase.',
    filename: 'phase_schedule.csv',
  },
  {
    id: 'sprint-csv',
    format: 'CSV',
    title: 'Sprint board',
    description: 'Every task with status, dates and priority, ready to import into ClickUp or Jira.',
    filename: 'sprint_distribution.csv',
  },
  {
    id: 'xlsx',
    format: 'XLSX',
    title: 'Excel Gantt',
    description: 'A colour-coded week grid, one row per phase.',
    filename: 'gantt_grid.xlsx',
    chart: true,
  },
  {
    id: 'pptx',
    format: 'PPTX',
    title: 'Editable Gantt slide',
    description: 'One 16:9 slide built from native, editable PowerPoint shapes.',
    filename: 'editable_gantt.pptx',
    chart: true,
  },
  {
    id: 'png',
    format: 'PNG',
    title: 'Gantt chart image',
    description: `The Gantt chart at ${GANTT_PNG.scale}× resolution, for decks and documents.`,
    filename: GANTT_PNG.filename,
    chart: true,
  },
]

type ExportsProps = {
  plan: LoadedPlan
  /** Called after plan.json downloads, so the app knows the edits are saved. */
  onSaved: () => void
}

export function Exports({ plan, onSaved }: ExportsProps) {
  const [busy, setBusy] = useState<ExportId | null>(null)
  const [done, setDone] = useState<ExportId | null>(null)
  const [errors, setErrors] = useState<Partial<Record<ExportId, string>>>({})

  const hasChart = plan.state.phases.some((p) => p.start_date && p.end_date && p.duration_weeks !== null)

  const run = async (id: ExportId) => {
    setBusy(id)
    setDone(null)
    setErrors((e) => ({ ...e, [id]: undefined }))
    try {
      if (id === 'png') await downloadGanttPng(plan)
      else await downloadExport(id, plan)
      setDone(id)
      if (id === 'plan-json') onSaved()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'The file could not be created.'
      setErrors((e) => ({ ...e, [id]: message }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">Exports</p>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">Export center</h1>
        <p className="text-sm text-muted-foreground">
          Files are built from the plan as it is now, including your edits.
        </p>
      </header>

      <section aria-label="Export files" className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {ITEMS.map((item) => {
            const unavailable = item.chart && !hasChart
            const isBusy = busy === item.id
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
                <span
                  className={cn(
                    'grid h-10 w-14 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-semibold',
                    item.id === 'plan-json' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {item.format}
                </span>
                <div className="flex min-w-56 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold">{item.title}</h2>
                    {item.id === 'plan-json' && <Badge variant="outline">Save your work</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {unavailable ? 'Add a phase with a start date and duration to export the chart.' : item.description}
                  </p>
                  {errors[item.id] && <FormError message={errors[item.id] ?? null} />}
                </div>
                <span className="hidden font-mono text-xs text-muted-foreground md:inline">{item.filename}</span>
                <Button
                  variant={item.id === 'plan-json' ? 'default' : 'outline'}
                  onClick={() => run(item.id)}
                  disabled={busy !== null || unavailable}
                  aria-label={`Download ${item.title} (${item.filename})`}
                  className="min-w-32"
                >
                  {isBusy ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : done === item.id ? (
                    <CircleCheck data-icon="inline-start" />
                  ) : (
                    <Download data-icon="inline-start" />
                  )}
                  {isBusy ? 'Preparing…' : done === item.id ? 'Downloaded' : 'Download'}
                </Button>
              </li>
            )
          })}
        </ul>
      </section>
      <p role="status" aria-live="polite" className="sr-only">
        {busy ? 'Preparing file…' : done ? `${ITEMS.find((i) => i.id === done)?.filename} downloaded.` : ''}
      </p>
    </div>
  )
}
