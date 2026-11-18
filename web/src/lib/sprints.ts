import { PRIORITIES, type SprintTask } from '@/lib/types'

export const BACKLOG = 'Backlog'
const DONE_STATUSES = new Set(['Complete', 'Closed'])

/** 'Sprint 3' → 3; `fallback` when there is no number (same as planner.schedule.parse_sprint_number). */
export function parseSprintNumber(label: string, fallback = 1): number {
  const match = /\d+/.exec(label)
  return match ? Number(match[0]) : fallback
}

/** The next label after the highest numbered sprint (planner.schedule.next_sprint_label). */
export function nextSprintLabel(sprints: string[]): string {
  const highest = Math.max(0, ...sprints.map((s) => parseSprintNumber(s, 0)))
  return `Sprint ${highest + 1}`
}

/** Add a sprint just before the Backlog, as the Streamlit "Add Sprint" button did. */
export function withNewSprint(sprints: string[]): string[] {
  const label = nextSprintLabel(sprints)
  const backlog = sprints.indexOf(BACKLOG)
  return backlog === -1 ? [...sprints, label] : [...sprints.slice(0, backlog), label, ...sprints.slice(backlog)]
}

export type SprintSummary = {
  total: number
  done: number
  /** Count per priority, in priority order, only for priorities that occur. */
  priorities: { priority: string; count: number }[]
  /** Earliest start and latest due date across the sprint's tasks. */
  from: string | null
  to: string | null
}

export function summarizeSprint(tasks: SprintTask[]): SprintSummary {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    const key = t.priority?.trim() || 'None'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const known: string[] = [...PRIORITIES]
  const order = [...known, ...[...counts.keys()].filter((p) => !known.includes(p)).sort()]
  const starts = tasks.map((t) => t.start_date).filter((d): d is string => !!d).sort()
  const dues = tasks.map((t) => t.due_date).filter((d): d is string => !!d).sort()
  return {
    total: tasks.length,
    done: tasks.filter((t) => DONE_STATUSES.has(t.status)).length,
    priorities: order.filter((p) => counts.has(p)).map((p) => ({ priority: p, count: counts.get(p)! })),
    from: starts[0] ?? null,
    to: dues.at(-1) ?? null,
  }
}
