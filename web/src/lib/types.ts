/** Mirrors server/schemas.py and planner/models.py. Dates are ISO strings (YYYY-MM-DD). */

/** Same options, in the same order, as the Streamlit sprint tables. */
export const TASK_STATUSES = ['To-Do', 'In Progress', 'In QA', 'Blocked', 'Complete', 'Closed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const PRIORITIES = ['Urgent', 'High', 'Normal', 'Low'] as const

export interface PhaseTaskItem {
  task_name: string
  phase: string
  duration_weeks: number
}

export interface SprintSubtaskItem {
  sprint_assignment: string
  subtask_name: string
  priority: string
}

/** The plan as Claude generated it (also the shape of plan.json). */
export interface ProjectBreakdown {
  project_summary: string
  key_risks: string[]
  agreed_timeline_weeks: number
  recommended_sprint_count: number
  phase_tasks: PhaseTaskItem[]
  sprint_subtasks: SprintSubtaskItem[]
}

export interface PhaseRow {
  id: string
  order: number | null
  task_name: string | null
  phase: string | null
  duration_weeks: number | null
  start_date: string | null
  end_date: string | null
}

export interface SprintTask {
  id: string
  sprint: string
  name: string
  status: TaskStatus
  start_date: string | null
  due_date: string | null
  priority: string | null
}

export interface ScheduleStatus {
  deadline: string
  latest_end: string | null
  on_track: boolean
  buffer_days: number | null
}

/** Everything the app shows for one plan. Lives in the browser; the API never stores it. */
export interface PlanState {
  project: ProjectBreakdown
  start_date: string
  phases: PhaseRow[]
  sprints: string[]
  tasks: SprintTask[]
  status: ScheduleStatus
}

export const PLAN_FILE_FORMAT = 'sow-architect/plan'

/** plan.json written by the web app: Claude's plan plus every edit (server/schemas.py PlanFile). */
export interface PlanFile {
  format: typeof PLAN_FILE_FORMAT
  version: 2
  name: string | null
  plan: ProjectBreakdown
  schedule: { start_date: string; phases: PhaseRow[]; sprints: string[]; tasks: SprintTask[] }
}

export function isPlanFile(value: unknown): value is PlanFile {
  return typeof value === 'object' && value !== null && (value as { format?: unknown }).format === PLAN_FILE_FORMAT
}

export interface LoadedPlan {
  name: string
  state: PlanState
}
