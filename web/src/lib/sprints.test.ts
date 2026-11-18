import { describe, expect, it } from 'vitest'

import { nextSprintLabel, parseSprintNumber, summarizeSprint, withNewSprint } from '@/lib/sprints'
import type { SprintTask } from '@/lib/types'

const task = (patch: Partial<SprintTask>): SprintTask => ({
  id: Math.random().toString(36).slice(2),
  sprint: 'Sprint 1',
  name: 'Task',
  status: 'To-Do',
  start_date: null,
  due_date: null,
  priority: 'Normal',
  ...patch,
})

describe('sprint helpers (match planner/schedule.py)', () => {
  it('parses sprint numbers', () => {
    expect(parseSprintNumber('Sprint 12')).toBe(12)
    expect(parseSprintNumber('Backlog')).toBe(1)
    expect(parseSprintNumber('Backlog', 0)).toBe(0)
  })

  it('labels the next sprint after the highest number', () => {
    expect(nextSprintLabel(['Sprint 1', 'Sprint 4', 'Backlog'])).toBe('Sprint 5')
    expect(nextSprintLabel(['Backlog'])).toBe('Sprint 1')
    expect(nextSprintLabel([])).toBe('Sprint 1')
  })

  it('adds a sprint just before the backlog', () => {
    expect(withNewSprint(['Sprint 1', 'Sprint 2', 'Backlog'])).toEqual(['Sprint 1', 'Sprint 2', 'Sprint 3', 'Backlog'])
    expect(withNewSprint(['Sprint 1'])).toEqual(['Sprint 1', 'Sprint 2'])
  })

  it('summarises progress, priorities and the date range', () => {
    const summary = summarizeSprint([
      task({ status: 'Complete', priority: 'High', start_date: '2026-01-07', due_date: '2026-01-16' }),
      task({ status: 'Closed', priority: 'Urgent', start_date: '2026-01-05', due_date: '2026-01-09' }),
      task({ status: 'In QA', priority: 'High' }),
      task({ priority: 'Medium' }),
      task({ priority: null }),
    ])
    expect(summary).toEqual({
      total: 5,
      done: 2,
      priorities: [
        { priority: 'Urgent', count: 1 },
        { priority: 'High', count: 2 },
        { priority: 'Medium', count: 1 },
        { priority: 'None', count: 1 },
      ],
      from: '2026-01-05',
      to: '2026-01-16',
    })
  })

  it('summarises an empty sprint', () => {
    expect(summarizeSprint([])).toEqual({ total: 0, done: 0, priorities: [], from: null, to: null })
  })
})
