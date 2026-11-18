import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { PhaseRow } from '@/lib/types'
import { cn } from '@/lib/utils'

import { EditableCell } from '@/components/table/EditableCell'
import { phaseBg } from './phaseColors'

type PhaseTableProps = {
  phases: PhaseRow[]
  colorOf: (phase: string | null) => number | undefined
  disabled: boolean
  onEdit: (id: string, patch: Partial<PhaseRow>) => void
  onAdd: () => void
  onDelete: (id: string) => void
}

const isOrder = (v: string) => /^\d+$/.test(v) && Number(v) >= 1
const isDuration = (v: string) => v !== '' && Number(v) >= 0.1 && Number(v) <= 50

const HEAD = 'h-10 px-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5'
const CELL = 'px-1 py-1 align-middle first:pl-3 last:pr-3'

export function PhaseTable({ phases, colorOf, disabled, onEdit, onAdd, onDelete }: PhaseTableProps) {
  return (
    <section aria-labelledby="phase-table-title" className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex flex-col gap-1">
          <h2 id="phase-table-title" className="eyebrow">
            Phases
          </h2>
          <p className="text-xs text-muted-foreground">
            Click a cell to edit. Change Order to rearrange; changing duration or start moves the end date, changing
            the end updates the duration. Weekends are skipped.
          </p>
        </div>
        <Button variant="outline" onClick={onAdd} disabled={disabled}>
          <Plus data-icon="inline-start" />
          Add phase
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className={cn(HEAD, 'w-20')}>Order</th>
              <th scope="col" className={HEAD}>Task name</th>
              <th scope="col" className={cn(HEAD, 'w-44')}>Phase</th>
              <th scope="col" className={cn(HEAD, 'w-28')}>Duration (weeks)</th>
              <th scope="col" className={cn(HEAD, 'w-40')}>Start date</th>
              <th scope="col" className={cn(HEAD, 'w-40')}>End date</th>
              <th scope="col" className={cn(HEAD, 'w-14')}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {phases.map((row) => {
              const name = row.task_name?.trim() || 'new phase'
              const color = colorOf(row.phase)
              return (
                <tr key={row.id} className="border-t border-border">
                  <td className={CELL}>
                    <EditableCell
                      label={`Order for ${name}`}
                      type="number"
                      min={1}
                      step={1}
                      value={row.order === null ? '' : String(row.order)}
                      isValid={isOrder}
                      disabled={disabled}
                      className="font-mono"
                      onCommit={(v) => onEdit(row.id, { order: Number(v) })}
                    />
                  </td>
                  <td className={CELL}>
                    <EditableCell
                      label={`Task name for ${name}`}
                      type="text"
                      value={row.task_name ?? ''}
                      disabled={disabled}
                      onCommit={(v) => onEdit(row.id, { task_name: v.trim() || null })}
                    />
                  </td>
                  <td className={CELL}>
                    <div className="flex items-center gap-1">
                      <span
                        aria-hidden="true"
                        className={cn('ml-2 size-2.5 shrink-0 rounded-sm', color === undefined ? 'bg-muted' : phaseBg(color))}
                      />
                      <EditableCell
                        label={`Phase for ${name}`}
                        type="text"
                        value={row.phase ?? ''}
                        disabled={disabled}
                        onCommit={(v) => onEdit(row.id, { phase: v.trim() || null })}
                      />
                    </div>
                  </td>
                  <td className={CELL}>
                    <EditableCell
                      label={`Duration (weeks) for ${name}`}
                      type="number"
                      min={0.1}
                      max={50}
                      step={0.5}
                      value={row.duration_weeks === null ? '' : String(row.duration_weeks)}
                      isValid={isDuration}
                      disabled={disabled}
                      className="font-mono"
                      onCommit={(v) => onEdit(row.id, { duration_weeks: Number(v) })}
                    />
                  </td>
                  <td className={CELL}>
                    <EditableCell
                      label={`Start date for ${name}`}
                      type="date"
                      value={row.start_date ?? ''}
                      disabled={disabled}
                      onCommit={(v) => onEdit(row.id, { start_date: v || null })}
                    />
                  </td>
                  <td className={CELL}>
                    <EditableCell
                      label={`End date for ${name}`}
                      type="date"
                      value={row.end_date ?? ''}
                      disabled={disabled}
                      onCommit={(v) => onEdit(row.id, { end_date: v || null })}
                    />
                  </td>
                  <td className={cn(CELL, 'text-right')}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${name}`}
                      disabled={disabled}
                      onClick={() => onDelete(row.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              )
            })}
            {phases.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No phases yet. Add one to start the schedule.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
