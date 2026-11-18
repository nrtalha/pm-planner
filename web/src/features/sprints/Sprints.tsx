import { ChevronsDownUp, ChevronsUpDown, Plus } from 'lucide-react'
import { useState } from 'react'

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
import { plural } from '@/lib/format'
import { newRowId } from '@/lib/ids'
import { BACKLOG, nextSprintLabel, summarizeSprint, withNewSprint } from '@/lib/sprints'
import type { PlanState, SprintTask } from '@/lib/types'

import { SprintCard } from './SprintCard'

type SprintsProps = {
  state: PlanState
  onChange: (next: PlanState) => void
}

export function Sprints({ state, onChange }: SprintsProps) {
  const { sprints, tasks } = state
  // The first sprint starts open; the rest are collapsed so the page stays scannable.
  const [open, setOpen] = useState<Set<string>>(() => new Set(sprints.slice(0, 1)))
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const sprintCount = sprints.filter((s) => s !== BACKLOG).length
  const allOpen = sprints.length > 0 && sprints.every((s) => open.has(s))

  const toggle = (name: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const setTasks = (next: SprintTask[]) => onChange({ ...state, tasks: next })

  const addSprint = () => {
    const label = nextSprintLabel(sprints)
    onChange({ ...state, sprints: withNewSprint(sprints) })
    setOpen((current) => new Set(current).add(label))
  }

  const deleteSprint = (name: string) => {
    onChange({ ...state, sprints: sprints.filter((s) => s !== name), tasks: tasks.filter((t) => t.sprint !== name) })
    setPendingDelete(null)
  }

  const requestDeleteSprint = (name: string) => {
    // Empty sprints go straight away; a sprint with tasks asks first.
    if (tasks.some((t) => t.sprint === name)) setPendingDelete(name)
    else deleteSprint(name)
  }

  const addTask = (sprint: string) => {
    const summary = summarizeSprint(tasks.filter((t) => t.sprint === sprint))
    setTasks([
      ...tasks,
      {
        id: newRowId(),
        sprint,
        name: 'New task',
        status: 'To-Do',
        start_date: summary.from,
        due_date: summary.to,
        priority: 'Normal',
      },
    ])
  }

  const pendingCount = pendingDelete ? tasks.filter((t) => t.sprint === pendingDelete).length : 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Sprints</p>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            Sprint distribution
          </h1>
          <p className="text-sm text-muted-foreground">
            {plural(tasks.length, 'task')} across {plural(sprintCount, 'sprint')}
            {sprints.includes(BACKLOG) ? ' and a backlog' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(sprints))}>
            {allOpen ? <ChevronsDownUp data-icon="inline-start" /> : <ChevronsUpDown data-icon="inline-start" />}
            {allOpen ? 'Collapse all' : 'Expand all'}
          </Button>
          <Button variant="outline" onClick={addSprint}>
            <Plus data-icon="inline-start" />
            Add sprint
          </Button>
        </div>
      </header>

      {sprints.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
          No sprints. Add one to start planning work.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sprints.map((name) => {
            const sprintTasks = tasks.filter((t) => t.sprint === name)
            return (
              <SprintCard
                key={name}
                name={name}
                tasks={sprintTasks}
                summary={summarizeSprint(sprintTasks)}
                open={open.has(name)}
                onToggle={() => toggle(name)}
                onDeleteSprint={() => requestDeleteSprint(name)}
                onAddTask={() => addTask(name)}
                onUpdateTask={(id, patch) => setTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)))}
                onDeleteTask={(id) => setTasks(tasks.filter((t) => t.id !== id))}
              />
            )
          })}
        </div>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(next) => !next && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the sprint and its {plural(pendingCount, 'task')}. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => pendingDelete && deleteSprint(pendingDelete)}>
              Delete sprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
