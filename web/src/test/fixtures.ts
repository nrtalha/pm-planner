import type { PlanState, ProjectBreakdown } from '@/lib/types'

export const PROJECT: ProjectBreakdown = {
  project_summary: 'Replatform the Northwind storefront to a headless stack.',
  key_risks: ['ERP API access may arrive late.', 'Loyalty export quality is unknown.'],
  agreed_timeline_weeks: 4,
  recommended_sprint_count: 2,
  phase_tasks: [
    { task_name: 'Discovery', phase: 'Discovery', duration_weeks: 1 },
    { task_name: 'Build', phase: 'Development', duration_weeks: 2 },
  ],
  sprint_subtasks: [
    { sprint_assignment: 'Sprint 1', subtask_name: 'PDP design', priority: 'High' },
    { sprint_assignment: 'Sprint 2', subtask_name: 'API integration', priority: 'Normal' },
  ],
}

export const PLAN_STATE: PlanState = {
  project: PROJECT,
  start_date: '2026-01-05',
  phases: [
    { id: 'p1', order: 1, task_name: 'Discovery', phase: 'Discovery', duration_weeks: 1, start_date: '2026-01-05', end_date: '2026-01-09' },
    { id: 'p2', order: 2, task_name: 'Build', phase: 'Development', duration_weeks: 2, start_date: '2026-01-12', end_date: '2026-01-23' },
  ],
  sprints: ['Sprint 1', 'Sprint 2', 'Backlog'],
  tasks: [
    { id: 't1', sprint: 'Sprint 1', name: 'PDP design', status: 'To-Do', start_date: '2026-01-05', due_date: '2026-01-16', priority: 'High' },
    { id: 't2', sprint: 'Sprint 2', name: 'API integration', status: 'To-Do', start_date: '2026-01-19', due_date: '2026-01-30', priority: 'Normal' },
  ],
  status: { deadline: '2026-01-30', latest_end: '2026-01-23', on_track: true, buffer_days: 7 },
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
