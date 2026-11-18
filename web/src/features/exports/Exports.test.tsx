import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { captureDownloads, fileResponse } from '@/test/downloads'
import { jsonResponse, PLAN_STATE } from '@/test/fixtures'

import { Exports } from './Exports'

vi.mock('plotly.js-basic-dist-min', () => ({ toImage: async () => 'data:image/png;base64,iVBORw0KGgo=' }))

const PLAN = { name: 'Northwind SOW', state: PLAN_STATE }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function setup(plan = PLAN) {
  const names = captureDownloads()
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('data:')) return new Response(new Blob(['png']))
    if (url === '/api/exports/gantt-figure') return jsonResponse({ data: [], layout: { height: 300 } })
    const kind = url.split('/').pop()!
    if (kind === 'xlsx') return jsonResponse({ detail: 'Excel export failed.' }, 500)
    const file = { 'phase-csv': 'phase_schedule.csv', 'sprint-csv': 'sprint_distribution.csv', pptx: 'editable_gantt.pptx', 'plan-json': 'plan.json' }[kind]!
    return fileResponse('x', file)
  })
  vi.stubGlobal('fetch', fetchMock)
  const onSaved = vi.fn()
  const user = userEvent.setup()
  render(<Exports plan={plan} onSaved={onSaved} />)
  return { names, fetchMock, onSaved, user }
}

const button = (name: RegExp) => screen.getByRole('button', { name })

describe('Exports', () => {
  it('lists all six exports', () => {
    setup()
    for (const file of ['plan.json', 'phase_schedule.csv', 'sprint_distribution.csv', 'gantt_grid.xlsx', 'editable_gantt.pptx', 'Project_Phase_Schedule.png']) {
      expect(screen.getByRole('button', { name: new RegExp(`\\(${file.replace('.', '\\.')}\\)`) })).toBeEnabled()
    }
  })

  it('downloads each file from its endpoint', async () => {
    const { names, fetchMock, user } = setup()
    await user.click(button(/Phase schedule/))
    await user.click(button(/Sprint board/))
    await user.click(button(/Editable Gantt slide/))
    await user.click(button(/Gantt chart image/))
    expect(names).toEqual(['phase_schedule.csv', 'sprint_distribution.csv', 'editable_gantt.pptx', 'Project_Phase_Schedule.png'])
    expect(fetchMock.mock.calls.map((c) => c[0]).filter((u) => u.startsWith('/api'))).toEqual([
      '/api/exports/phase-csv',
      '/api/exports/sprint-csv',
      '/api/exports/pptx',
      '/api/exports/gantt-figure',
    ])
    expect(screen.getAllByText('Downloaded')).toHaveLength(1)
  })

  it('marks the plan as saved only after plan.json downloads', async () => {
    const { onSaved, user } = setup()
    await user.click(button(/Phase schedule/))
    expect(onSaved).not.toHaveBeenCalled()
    await user.click(button(/Saved plan/))
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('shows an error on the row that failed', async () => {
    const { user, names } = setup()
    await user.click(button(/Excel Gantt/))
    const row = button(/Excel Gantt/).closest('li')!
    expect(within(row).getByRole('alert')).toHaveTextContent('Excel export failed.')
    expect(names).toEqual([])
  })

  it('disables chart exports until a phase has dates', () => {
    setup({ ...PLAN, state: { ...PLAN_STATE, phases: [{ ...PLAN_STATE.phases[0]!, start_date: null }] } })
    expect(button(/Excel Gantt/)).toBeDisabled()
    expect(button(/Editable Gantt slide/)).toBeDisabled()
    expect(button(/Gantt chart image/)).toBeDisabled()
    expect(button(/Phase schedule/)).toBeEnabled()
    expect(screen.getAllByText('Add a phase with a start date and duration to export the chart.')).toHaveLength(3)
  })
})
