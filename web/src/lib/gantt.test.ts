import { describe, expect, it } from 'vitest'

import { addDays, daysBetween, nextWeekday } from '@/lib/dates'
import { buildGantt } from '@/lib/gantt'
import { PLAN_STATE } from '@/test/fixtures'

describe('dates', () => {
  it('adds and diffs calendar days', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
    expect(daysBetween('2026-01-05', '2026-01-30')).toBe(25)
  })

  it('finds the next weekday', () => {
    expect(nextWeekday('2026-01-23')).toBe('2026-01-26') // Fri → Mon
    expect(nextWeekday('2026-01-05')).toBe('2026-01-06') // Mon → Tue
    expect(nextWeekday('2026-01-24')).toBe('2026-01-26') // Sat → Mon
  })
})

describe('buildGantt', () => {
  const { phases, start_date, status } = PLAN_STATE

  it('matches planner/exporters.py week_axis for the fixture plan', () => {
    // Python: min = 5 Jan, max = max(26 Jan, deadline 30 Jan) → 25 days → 25 // 7 + 2 = 5 weeks
    const gantt = buildGantt(phases, start_date, status.deadline)!
    expect(gantt.weeks).toEqual(['W1', 'W2', 'W3', 'W4', 'W5'])
    expect(gantt.axisStart).toBe('2026-01-05')
    expect(gantt.bars.map((b) => [b.leftPct, b.widthPct])).toEqual([
      [0, 20],
      [20, 40],
    ])
    expect(gantt.deadlinePct).toBeCloseTo((25 / 35) * 100)
  })

  it('colours phases in order of first appearance, like phase_color_map', () => {
    const gantt = buildGantt(
      [
        { ...phases[1]!, id: 'a', order: 1, phase: 'Build' },
        { ...phases[0]!, id: 'b', order: 2, phase: 'Discovery' },
        { ...phases[0]!, id: 'c', order: 3, phase: 'Build' },
        { ...phases[0]!, id: 'd', order: 4, phase: null },
      ],
      start_date,
      status.deadline,
    )!
    expect(gantt.bars.map((b) => [b.phase, b.colorIndex])).toEqual([
      ['Build', 0],
      ['Discovery', 1],
      ['Build', 0],
      ['Uncategorized', 2],
    ])
  })

  it('skips rows without dates or duration and sorts by order', () => {
    const gantt = buildGantt(
      [{ ...phases[1]!, order: 1 }, { ...phases[0]!, order: 2 }, { ...phases[0]!, id: 'x', order: 3, start_date: null }],
      start_date,
      status.deadline,
    )!
    expect(gantt.bars.map((b) => b.label)).toEqual(['Build', 'Discovery'])
  })

  it('returns null when nothing can be drawn', () => {
    expect(buildGantt([], start_date, status.deadline)).toBeNull()
  })

  it('extends the axis to the project start when it is earlier than every phase', () => {
    const gantt = buildGantt(phases, '2025-12-29', status.deadline)!
    expect(gantt.axisStart).toBe('2025-12-29')
    expect(gantt.bars[0]!.leftPct).toBeGreaterThan(0)
  })
})
