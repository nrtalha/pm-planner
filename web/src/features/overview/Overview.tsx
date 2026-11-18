import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { formatDate, plural } from '@/lib/format'
import type { LoadedPlan } from '@/lib/types'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'good' | 'bad'

function Metric({ label, value, sub, tone = 'default' }: { label: string; value: string; sub: string; tone?: Tone }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          'font-heading text-2xl font-bold tracking-tight text-heading',
          tone === 'good' && 'text-success',
          tone === 'bad' && 'text-destructive',
        )}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}

function Panel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const id = `panel-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id={id} className="eyebrow">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function bufferText(days: number | null): { value: string; sub: string; tone: Tone } {
  if (days === null) return { value: '—', sub: 'Add dated phases to see the buffer', tone: 'default' }
  if (days < 0) return { value: `${plural(-days, 'day')} over`, sub: 'Phases run past the deadline', tone: 'bad' }
  if (days === 0) return { value: '0 days', sub: 'Finishes on the deadline', tone: 'default' }
  return { value: plural(days, 'day'), sub: 'Before the deadline', tone: 'good' }
}

export function Overview({ plan }: { plan: LoadedPlan }) {
  const { name, state } = plan
  const { project, status } = state
  const sprintCount = state.sprints.filter((s) => s !== 'Backlog').length
  const buffer = bufferText(status.buffer_days)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Delivery plan</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            {name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(state.start_date)} → {formatDate(status.deadline)} ·{' '}
            {plural(project.agreed_timeline_weeks, 'week')} contract
          </p>
        </div>
        {status.on_track ? (
          <Badge variant="success" className="h-7 px-3 text-sm">
            <CircleCheck aria-hidden="true" />
            On track
          </Badge>
        ) : (
          <Badge variant="destructive" className="h-7 px-3 text-sm">
            <CircleAlert aria-hidden="true" />
            Deadline breach
          </Badge>
        )}
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Planned finish"
          value={formatDate(status.latest_end)}
          sub={`Deadline ${formatDate(status.deadline)}`}
          tone={status.on_track ? 'default' : 'bad'}
        />
        <Metric label="Schedule buffer" value={buffer.value} sub={buffer.sub} tone={buffer.tone} />
        <Metric
          label="Contract timeline"
          value={plural(project.agreed_timeline_weeks, 'week')}
          sub={`Starts ${formatDate(state.start_date)}`}
        />
        <Metric
          label="Workload"
          value={plural(state.tasks.length, 'task')}
          sub={`${plural(state.phases.length, 'phase')} · ${plural(sprintCount, 'sprint')} + backlog`}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Panel title="Project summary">
          <p className="px-5 py-5 text-sm leading-7">{project.project_summary}</p>
        </Panel>
        <Panel
          title="Critical insights and risks"
          aside={<Badge variant="outline">{project.key_risks.length}</Badge>}
        >
          {project.key_risks.length === 0 ? (
            <p className="px-5 py-5 text-sm text-muted-foreground">No risks were identified in the SOW.</p>
          ) : (
            <ol className="divide-y divide-border">
              {project.key_risks.map((risk, index) => (
                <li key={`${index}-${risk.slice(0, 24)}`} className="flex gap-4 px-5 py-3.5 text-sm leading-6">
                  <span className="font-mono text-xs leading-6 text-label">{String(index + 1).padStart(2, '0')}</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  )
}
