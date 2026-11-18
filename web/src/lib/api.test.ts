import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, generatePlan, openPlan } from '@/lib/api'
import { jsonResponse, PLAN_STATE, PROJECT } from '@/test/fixtures'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('uploads the SOW as multipart form data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PLAN_STATE))
    vi.stubGlobal('fetch', fetchMock)
    const file = new File(['%PDF-1.4'], 'sow.pdf', { type: 'application/pdf' })

    await expect(generatePlan({ file, startDate: '2026-01-05', targetWeeks: 12 })).resolves.toEqual(PLAN_STATE)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/plans/generate')
    const body = init.body as FormData
    expect(body.get('file')).toBeInstanceOf(File)
    expect(body.get('start_date')).toBe('2026-01-05')
    expect(body.get('target_weeks')).toBe('12')
  })

  it('sends plan.json as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PLAN_STATE))
    vi.stubGlobal('fetch', fetchMock)
    await openPlan(PROJECT, '2026-01-05')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/plans/open')
    expect(JSON.parse(init.body as string)).toEqual({ plan: PROJECT, start_date: '2026-01-05' })
  })

  it('surfaces the server message for errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Claude Code is not logged in.' }, 502)))
    const err = await openPlan({}, '2026-01-05').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 502, message: 'Claude Code is not logged in.' })
  })

  it('summarises validation errors', async () => {
    const detail = [{ loc: ['body', 'plan', 'phase_tasks'], msg: 'Field required' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail }, 422)))
    await expect(openPlan({}, '2026-01-05')).rejects.toThrow(
      "The plan doesn't match the expected format. plan → phase_tasks: Field required",
    )
  })

  it('explains when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(openPlan({}, '2026-01-05')).rejects.toThrow("Can't reach the local API")
  })

  it('lets aborts through untouched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    await expect(openPlan({}, '2026-01-05')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
