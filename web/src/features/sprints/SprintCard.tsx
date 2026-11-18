import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useId } from 'react'

import { EditableCell } from '@/components/table/EditableCell'
import { SelectCell } from '@/components/table/SelectCell'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { SprintSummary } from '@/lib/sprints'
import { PRIORITIES, TASK_STATUSES, type SprintTask, type TaskStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

import { priorityDot } from './priorityStyles'

type SprintCardProps = {
  name: string
  tasks: SprintTask[]
  summary: SprintSummary
  open: boolean
  onToggle: () => void
  onDeleteSprint: () => void
  onAddTask: () => void
  onUpdateTask: (id: string, patch: Partial<SprintTask>) => void
  onDeleteTask: (id: string) => void
}

const HEAD = 'h-10 px-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5'
const CELL = 'px-1 py-1 align-middle first:pl-3 last:pr-3'
const hasText = (v: string) => v.trim().length > 0

function dateRange({ from, to }: SprintSummary) {
  if (!from && !to) return 'No dates'
  return `${formatDate(from)} – ${formatDate(to)}`
}

export function SprintCard(props: SprintCardProps) {
  const { name, tasks, summary, open, onToggle, onDeleteSprint, onAddTask, onUpdateTask, onDeleteTask } = props
  const bodyId = useId()
  const percent = summary.total === 0 ? 0 : Math.round((summary.done / summary.total) * 100)

  return (
    <section aria-label={name} className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5', open && 'bg-muted/40')}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-11 min-w-56 flex-1 items-center gap-3 rounded-lg px-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronRight
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
            aria-hidden="true"
          />
          <span className="font-heading text-base font-bold text-heading">{name}</span>
          <span className="font-mono text-xs text-muted-foreground">{dateRange(summary)}</span>
        </button>

        <ul className="flex items-center gap-3 text-xs text-muted-foreground" aria-label={`${name} priorities`}>
          {summary.priorities.map(({ priority, count }) => (
            <li key={priority} className="flex items-center gap-1.5" title={`${count} ${priority}`}>
              <span aria-hidden="true" className={cn('size-2 rounded-full', priorityDot(priority))} />
              <span className="sr-only">{priority}:</span>
              {count}
            </li>
          ))}
        </ul>

        <div className="flex min-w-40 items-center gap-2">
          <div
            role="progressbar"
            aria-label={`${name} progress`}
            aria-valuemin={0}
            aria-valuemax={summary.total}
            aria-valuenow={summary.done}
            aria-valuetext={`${summary.done} of ${summary.total} tasks complete`}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {summary.done}/{summary.total}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${name}`}
          onClick={onDeleteSprint}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </div>

      {open && (
        <div id={bodyId} className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className={HEAD}>Name</th>
                  <th scope="col" className={cn(HEAD, 'w-36')}>Status</th>
                  <th scope="col" className={cn(HEAD, 'w-40')}>Start date</th>
                  <th scope="col" className={cn(HEAD, 'w-40')}>Due date</th>
                  <th scope="col" className={cn(HEAD, 'w-32')}>Priority</th>
                  <th scope="col" className={cn(HEAD, 'w-14')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-t border-border">
                    <td className={CELL}>
                      <EditableCell
                        label={`Name for ${task.name}`}
                        type="text"
                        value={task.name}
                        isValid={hasText}
                        onCommit={(v) => onUpdateTask(task.id, { name: v.trim() })}
                      />
                    </td>
                    <td className={CELL}>
                      <SelectCell
                        label={`Status for ${task.name}`}
                        value={task.status}
                        options={TASK_STATUSES}
                        onChange={(v) => onUpdateTask(task.id, { status: v as TaskStatus })}
                      />
                    </td>
                    <td className={CELL}>
                      <EditableCell
                        label={`Start date for ${task.name}`}
                        type="date"
                        value={task.start_date ?? ''}
                        onCommit={(v) => onUpdateTask(task.id, { start_date: v || null })}
                      />
                    </td>
                    <td className={CELL}>
                      <EditableCell
                        label={`Due date for ${task.name}`}
                        type="date"
                        value={task.due_date ?? ''}
                        onCommit={(v) => onUpdateTask(task.id, { due_date: v || null })}
                      />
                    </td>
                    <td className={CELL}>
                      <SelectCell
                        label={`Priority for ${task.name}`}
                        value={task.priority ?? ''}
                        options={PRIORITIES}
                        adornment={<span className={cn('size-2 rounded-full', priorityDot(task.priority))} />}
                        onChange={(v) => onUpdateTask(task.id, { priority: v || null })}
                      />
                    </td>
                    <td className={cn(CELL, 'text-right')}>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete task ${task.name}`}
                        onClick={() => onDeleteTask(task.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-sm text-muted-foreground">
                      No tasks in {name} yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-3 py-2">
            <Button variant="ghost" onClick={onAddTask}>
              <Plus data-icon="inline-start" />
              Add task
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
