import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import type { PhaseRow, PlanState, ScheduleStatus } from '@/lib/types'
import { jsonResponse, PLAN_STATE } from '@/test/fixtures'

import { Timeline } from './Timeline'

type ScheduleBody = { start_date: string; agreed_weeks: number; previous: PhaseRow[]; edited: PhaseRow[] }

function setup(responder: (body: ScheduleBody) => { phases: PhaseRow[]; status: ScheduleStatus } | Response) {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const result = responder(JSON.parse(init.body as string) as ScheduleBody)
    return result instanceof Response ? result : jsonResponse(result)
  })
  vi.stubGlobal('fetch', fetchMock)
  const onChange = vi.fn<(s: PlanState) => void>()
  render(
    <TooltipProvider>
      <Timeline state={PLAN_STATE} onChange={onChange} />
    </TooltipProvider>,
  )
  const lastBody = () => JSON.parse((fetchMock.mock.lastCall![1] as RequestInit).body as string) as ScheduleBody
  return { fetchMock, onChange, lastBody }
}

const echo = (body: ScheduleBody) => ({ phases: body.edited, status: PLAN_STATE.status })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Timeline', () => {
  it('shows the phases, the deadline check and a bar per dated phase', () => {
    setup(echo)
    expect(screen.getByRole('heading', { name: 'Phase schedule' })).toBeInTheDocument()
    expect(screen.getByLabelText('Task name for Discovery')).toHaveValue('Discovery')
    expect(screen.getByLabelText('End date for Build')).toHaveValue('2026-01-23')
    expect(screen.getByText(/On track\./)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Build: Development, 2 weeks/)).toBeInTheDocument()
    expect(screen.getAllByText(/^W\d$/)).toHaveLength(5)
  })

  it('sends a duration edit to the API and applies the recalculated end date', async () => {
    const user = userEvent.setup()
    const { onChange, lastBody } = setup((body) => ({
      phases: body.edited.map((p) => (p.id === 'p2' ? { ...p, end_date: '2026-01-30' } : p)),
      status: { ...PLAN_STATE.status, latest_end: '2026-01-30', buffer_days: 0 },
    }))
    const duration = screen.getByLabelText('Duration (weeks) for Build')
    await user.clear(duration)
    await user.type(duration, '3{Enter}')

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    const body = lastBody()
    expect(body.previous).toEqual(PLAN_STATE.phases)
    expect(body.edited.find((p) => p.id === 'p2')!.duration_weeks).toBe(3)
    expect(body.agreed_weeks).toBe(4)
    const next = onChange.mock.calls[0]![0]
    expect(next.phases.find((p) => p.id === 'p2')!.end_date).toBe('2026-01-30')
    expect(next.status.buffer_days).toBe(0)
  })

  it('does not send invalid values', async () => {
    const user = userEvent.setup()
    const { fetchMock } = setup(echo)
    const duration = screen.getByLabelText('Duration (weeks) for Build')
    await user.clear(duration)
    await user.type(duration, '0{Enter}')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(duration).toHaveValue(2)
  })

  it('sends a picked date once, not again on blur', async () => {
    const { fetchMock, onChange } = setup(echo)
    const end = screen.getByLabelText('End date for Build')
    fireEvent.change(end, { target: { value: '2026-02-06' } })
    fireEvent.blur(end)
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('moves the deadline when the project start date changes', async () => {
    const { lastBody, onChange } = setup(() => ({
      phases: PLAN_STATE.phases,
      status: { deadline: '2026-01-23', latest_end: '2026-01-23', on_track: true, buffer_days: 0 },
    }))
    fireEvent.change(screen.getByLabelText('Project start date'), { target: { value: '2025-12-29' } })
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(lastBody().start_date).toBe('2025-12-29')
    expect(lastBody().edited).toEqual(PLAN_STATE.phases)
    expect(onChange.mock.calls[0]![0].start_date).toBe('2025-12-29')
  })

  it('adds a phase starting the weekday after the last phase ends', async () => {
    const user = userEvent.setup()
    const { lastBody } = setup(echo)
    await user.click(screen.getByRole('button', { name: 'Add phase' }))
    await waitFor(() => expect(lastBody().edited).toHaveLength(3))
    expect(lastBody().edited[2]).toMatchObject({
      order: null,
      task_name: 'New phase',
      duration_weeks: 1,
      start_date: '2026-01-26',
      end_date: null,
    })
  })

  it('deletes a phase', async () => {
    const user = userEvent.setup()
    const { lastBody } = setup(echo)
    await user.click(screen.getByRole('button', { name: 'Delete Discovery' }))
    await waitFor(() => expect(lastBody().edited.map((p) => p.id)).toEqual(['p2']))
  })

  it('shows the breach message', () => {
    vi.stubGlobal('fetch', vi.fn())
    render(
      <TooltipProvider>
        <Timeline
          state={{ ...PLAN_STATE, status: { deadline: '2026-01-30', latest_end: '2026-02-06', on_track: false, buffer_days: -7 } }}
          onChange={vi.fn()}
        />
      </TooltipProvider>,
    )
    expect(screen.getByText(/Deadline breach\./).closest('p')).toHaveTextContent('Phases run to 6 Feb 2026, past the 30 Jan 2026 deadline.')
  })

  it('reports API errors and keeps the plan unchanged', async () => {
    const user = userEvent.setup()
    const { onChange } = setup(() => jsonResponse({ detail: 'Schedule service unavailable.' }, 500))
    await user.click(screen.getByRole('button', { name: 'Delete Build' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Schedule service unavailable.')
    expect(onChange).not.toHaveBeenCalled()
  })
})
