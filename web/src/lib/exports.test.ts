import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadExport, downloadGanttPng, openPlan } from '@/lib/api'
import { filenameFromDisposition } from '@/lib/download'
import type { PlanFile } from '@/lib/types'
import { captureDownloads, fileResponse } from '@/test/downloads'
import { jsonResponse, PLAN_STATE, PROJECT } from '@/test/fixtures'

const toImage = vi.fn(async () => 'data:image/png;base64,iVBORw0KGgo=')
vi.mock('plotly.js-basic-dist-min', () => ({ toImage }))

const PLAN = { name: 'Northwind SOW', state: PLAN_STATE }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  toImage.mockClear()
})

describe('exports', () => {
  it('reads the file name from Content-Disposition', () => {
    expect(filenameFromDisposition('attachment; filename="gantt_grid.xlsx"', 'x')).toBe('gantt_grid.xlsx')
    expect(filenameFromDisposition(null, 'fallback.csv')).toBe('fallback.csv')
  })

  it('posts the on-screen plan, edits and sprint list included, and downloads the file', async () => {
    const names = captureDownloads()
    const fetchMock = vi.fn().mockResolvedValue(fileResponse('Order,Task Name', 'phase_schedule.csv'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(downloadExport('phase-csv', PLAN)).resolves.toBe('phase_schedule.csv')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/exports/phase-csv')
    expect(JSON.parse(init.body as string)).toEqual({
      project: PROJECT,
      start_date: PLAN_STATE.start_date,
      phases: PLAN_STATE.phases,
      tasks: PLAN_STATE.tasks,
      sprints: PLAN_STATE.sprints,
      name: 'Northwind SOW',
    })
    expect(names).toEqual(['phase_schedule.csv'])
  })

  it('renders the PNG from the API figure at 3x with plotly.js', async () => {
    const names = captureDownloads()
    const figure = { data: [{ type: 'bar' }], layout: { height: 330 } }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.startsWith('data:') ? new Response(new Blob(['png'])) : jsonResponse(figure),
      ),
    )

    await expect(downloadGanttPng(PLAN)).resolves.toBe('Project_Phase_Schedule.png')
    expect(toImage).toHaveBeenCalledWith(figure, { format: 'png', width: 1400, height: 330, scale: 3 })
    expect(names).toEqual(['Project_Phase_Schedule.png'])
  })

  it('surfaces API errors for exports', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Add at least one phase.' }, 409)))
    await expect(downloadExport('xlsx', PLAN)).rejects.toThrow('Add at least one phase.')
  })
})

describe('openPlan', () => {
  it('sends a saved plan as-is, and an original plan with the start date', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(PLAN_STATE))
    vi.stubGlobal('fetch', fetchMock)
    const saved: PlanFile = {
      format: 'sow-architect/plan',
      version: 2,
      name: 'Northwind SOW',
      plan: PROJECT,
      schedule: { start_date: '2026-01-05', phases: [], sprints: [], tasks: [] },
    }

    await openPlan(saved, '2026-03-02')
    await openPlan(PROJECT, '2026-03-02')

    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string))
    expect(bodies[0]).toEqual({ saved })
    expect(bodies[1]).toEqual({ plan: PROJECT, start_date: '2026-03-02' })
  })
})
