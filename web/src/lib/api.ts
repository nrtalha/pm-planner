import { filenameFromDisposition, saveBlob } from '@/lib/download'
import { isPlanFile, type LoadedPlan, type PhaseRow, type PlanState, type ScheduleStatus } from '@/lib/types'

/** An API failure with a message that is safe to show the user. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ValidationIssue = { loc?: (string | number)[]; msg?: string }

function describeValidation(issues: ValidationIssue[]): string {
  const lines = issues.slice(0, 3).map((issue) => {
    const where = (issue.loc ?? []).filter((part) => part !== 'body').join(' → ')
    return where ? `${where}: ${issue.msg ?? 'invalid'}` : (issue.msg ?? 'invalid')
  })
  const more = issues.length > 3 ? ` (and ${issues.length - 3} more)` : ''
  return `The plan doesn't match the expected format. ${lines.join('; ')}${more}`
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return describeValidation(detail as ValidationIssue[])
  } catch {
    // Not JSON; fall through to the generic message.
  }
  return `The request failed (HTTP ${res.status}).`
}

async function send(path: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError("Can't reach the local API. Check that the server is running.", 0)
  }
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status)
  return res
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  return (await (await send(path, init)).json()) as T
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export type GenerateInput = {
  file: File
  startDate: string
  /** 0 keeps the SOW's own timeline. */
  targetWeeks: number
}

/** Upload a SOW and let Claude Code build the plan. Usually 30–60 seconds. */
export function generatePlan({ file, startDate, targetWeeks }: GenerateInput, signal?: AbortSignal) {
  const form = new FormData()
  form.append('file', file)
  form.append('start_date', startDate)
  form.append('target_weeks', String(targetWeeks))
  return request<PlanState>('/api/plans/generate', { method: 'POST', body: form, signal })
}

export type ScheduleInput = {
  startDate: string
  agreedWeeks: number
  /** Rows as they were before the edit. */
  previous: PhaseRow[]
  /** Rows after the edit (a changed cell, an added or deleted row). */
  edited: PhaseRow[]
}

/** Recalculate end dates / durations / order after an edit, plus the deadline check. */
export function reconcileSchedule({ startDate, agreedWeeks, previous, edited }: ScheduleInput, signal?: AbortSignal) {
  return request<{ phases: PhaseRow[]; status: ScheduleStatus }>('/api/schedule', {
    ...json({ start_date: startDate, agreed_weeks: agreedWeeks, previous, edited }),
    signal,
  })
}

/**
 * Reopen a plan.json. A file saved by this app comes back exactly as edited (its own start
 * date is used); an original Streamlit-era plan is laid out from `startDate`. Validated by the API.
 */
export function openPlan(file: unknown, startDate: string, signal?: AbortSignal) {
  const body = isPlanFile(file) ? { saved: file } : { plan: file, start_date: startDate }
  return request<PlanState>('/api/plans/open', { ...json(body), signal })
}

export type ExportKind = 'phase-csv' | 'sprint-csv' | 'xlsx' | 'pptx' | 'plan-json'

const EXPORT_FALLBACK_NAMES: Record<ExportKind, string> = {
  'phase-csv': 'phase_schedule.csv',
  'sprint-csv': 'sprint_distribution.csv',
  xlsx: 'gantt_grid.xlsx',
  pptx: 'editable_gantt.pptx',
  'plan-json': 'plan.json',
}

/** Everything the export endpoints need: the plan as it is on screen, edits included. */
function exportBody({ name, state }: LoadedPlan) {
  return {
    project: state.project,
    start_date: state.start_date,
    phases: state.phases,
    tasks: state.tasks,
    sprints: state.sprints,
    name,
  }
}

/** Build an export file on the server (same Python code as the Streamlit app) and download it. */
export async function downloadExport(kind: ExportKind, plan: LoadedPlan): Promise<string> {
  const res = await send(`/api/exports/${kind}`, json(exportBody(plan)))
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), EXPORT_FALLBACK_NAMES[kind])
  saveBlob(await res.blob(), filename)
  return filename
}

export const GANTT_PNG = { filename: 'Project_Phase_Schedule.png', width: 1400, scale: 3 } as const

/**
 * The Gantt chart as a PNG. The API returns the same Plotly figure the Python exports use;
 * plotly.js (loaded only now) renders it at 3× like the Streamlit chart's camera button.
 */
export async function downloadGanttPng(plan: LoadedPlan): Promise<string> {
  const figure = await request<{ data: unknown[]; layout: { height?: number } & Record<string, unknown> }>(
    '/api/exports/gantt-figure',
    json(exportBody(plan)),
  )
  const Plotly = await import('plotly.js-basic-dist-min')
  const dataUrl = await Plotly.toImage(figure, {
    format: 'png',
    width: GANTT_PNG.width,
    height: figure.layout.height ?? 600,
    scale: GANTT_PNG.scale,
  })
  saveBlob(await (await fetch(dataUrl)).blob(), GANTT_PNG.filename)
  return GANTT_PNG.filename
}
