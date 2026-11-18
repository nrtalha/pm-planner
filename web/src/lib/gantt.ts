import { addDays, daysBetween } from '@/lib/dates'
import type { PhaseRow } from '@/lib/types'

/**
 * Gantt geometry. Mirrors planner/exporters.py (prepare_chart_df, week_axis, phase_color_map)
 * so the screen, the Excel/PowerPoint exports and the PNG all draw the same chart.
 */

/** Same order as PHASE_COLORS in planner/exporters.py (CSS variables --phase-1 … --phase-6). */
export const PHASE_COLOR_COUNT = 6

export type GanttBar = {
  id: string
  label: string
  phase: string
  colorIndex: number
  start: string
  /** Business-day end date (what the table shows). */
  end: string
  durationWeeks: number
  leftPct: number
  widthPct: number
}

export type Gantt = {
  bars: GanttBar[]
  weeks: string[]
  axisStart: string
  deadlinePct: number
  legend: { phase: string; colorIndex: number }[]
}

export function buildGantt(phases: PhaseRow[], projectStart: string, deadline: string): Gantt | null {
  const rows = phases
    .filter((p) => p.start_date && p.end_date && p.duration_weeks !== null)
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  if (rows.length === 0) return null

  // Bars are drawn start + duration × 7 calendar days so they line up with week gridlines.
  // For the axis, Python takes the .date() of that datetime, i.e. rounds down to whole days.
  const visualEnd = (p: PhaseRow) => addDays(p.start_date!, Math.floor(p.duration_weeks! * 7))
  const axisStart = [projectStart, ...rows.map((p) => p.start_date!)].reduce((a, b) => (a < b ? a : b))
  const axisEnd = [deadline, ...rows.map(visualEnd)].reduce((a, b) => (a > b ? a : b))
  const weekCount = Math.max(1, Math.floor(daysBetween(axisStart, axisEnd) / 7) + 2)
  const totalDays = weekCount * 7
  const pct = (iso: string) => (daysBetween(axisStart, iso) / totalDays) * 100

  const colorOf = new Map<string, number>()
  const bars = rows.map((p) => {
    const phase = p.phase?.trim() || 'Uncategorized'
    if (!colorOf.has(phase)) colorOf.set(phase, colorOf.size % PHASE_COLOR_COUNT)
    return {
      id: p.id,
      label: p.task_name?.trim() || 'New Task',
      phase,
      colorIndex: colorOf.get(phase)!,
      start: p.start_date!,
      end: p.end_date!,
      durationWeeks: p.duration_weeks!,
      leftPct: pct(p.start_date!),
      widthPct: Math.max(0.5, ((p.duration_weeks! * 7) / totalDays) * 100),
    }
  })

  return {
    bars,
    weeks: Array.from({ length: weekCount }, (_, i) => `W${i + 1}`),
    axisStart,
    deadlinePct: pct(deadline),
    legend: [...colorOf].map(([phase, colorIndex]) => ({ phase, colorIndex })),
  }
}
