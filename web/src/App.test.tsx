import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { TooltipProvider } from '@/components/ui/tooltip'
import { THEME_STORAGE_KEY } from '@/lib/theme'
import type { PlanFile } from '@/lib/types'
import { captureDownloads, fileResponse } from '@/test/downloads'
import { jsonResponse, PLAN_STATE, PROJECT } from '@/test/fixtures'

function renderApp() {
  return render(
    <TooltipProvider>
      <App />
    </TooltipProvider>,
  )
}

const pdf = () => new File(['%PDF-1.4 test'], 'northwind-sow.pdf', { type: 'application/pdf' })

describe('App shell', () => {
  beforeEach(() => {
    document.documentElement.className = 'dark'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the empty state and the four plan sections', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'No plan yet' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Plan sections' })
    for (const label of ['Overview', 'Timeline', 'Sprints', 'Exports']) {
      expect(nav).toContainElement(screen.getByRole('button', { name: label }))
    }
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  })

  it('switches section and keeps it in the URL', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: /^Timeline/ }))
    expect(screen.getByRole('button', { name: /^Timeline/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Overview' })).not.toHaveAttribute('aria-current')
    expect(window.location.search).toBe('?view=timeline')
  })

  it('opens on the section named in the URL', () => {
    window.history.replaceState(null, '', '/?view=sprints')
    renderApp()
    expect(screen.getByRole('button', { name: 'Sprints' })).toHaveAttribute('aria-current', 'page')
  })

  it('defaults to dark and toggles to light, remembering the choice', async () => {
    renderApp()
    expect(document.documentElement).toHaveClass('dark')
    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument()
  })
})

describe('New plan', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('generates a plan from a SOW and shows the overview', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PLAN_STATE))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getAllByRole('button', { name: /New plan/ })[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'Plan from a SOW' })
    const generate = within(dialog).getByRole('button', { name: 'Generate plan' })
    expect(generate).toBeDisabled()

    await user.upload(within(dialog).getByLabelText('SOW or project charter'), pdf())
    await user.type(within(dialog).getByLabelText('Target timeline (weeks)'), '12')
    await user.click(generate)

    expect(await screen.findByRole('heading', { name: 'Northwind SOW' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as FormData
    expect(body.get('target_weeks')).toBe('12')
    expect(body.get('start_date')).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    expect(screen.getByText('On track')).toBeInTheDocument()
    expect(screen.getByText('23 Jan 2026')).toBeInTheDocument()
    expect(screen.getByText('7 days')).toBeInTheDocument()
    expect(screen.getByText(PROJECT.project_summary)).toBeInTheDocument()
    for (const risk of PROJECT.key_risks) expect(screen.getByText(risk)).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Northwind SOW')
  })

  it('rejects files that are not PDFs', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderApp()
    await user.click(screen.getAllByRole('button', { name: /New plan/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.upload(within(dialog).getByLabelText('SOW or project charter'), new File(['x'], 'notes.txt'))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose a PDF file.')
    expect(within(dialog).getByRole('button', { name: 'Generate plan' })).toBeDisabled()
  })

  it('shows the API error and keeps the form open', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Claude Code is not logged in.' }, 502)))
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getAllByRole('button', { name: /New plan/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.upload(within(dialog).getByLabelText('SOW or project charter'), pdf())
    await user.click(within(dialog).getByRole('button', { name: 'Generate plan' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Claude Code is not logged in.')
    expect(within(dialog).getByRole('button', { name: 'Generate plan' })).toBeEnabled()
  })

  it('shows progress while generating and can be cancelled', async () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal ?? undefined
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
        })
      }),
    )
    const user = userEvent.setup()
    renderApp()
    await user.click(screen.getAllByRole('button', { name: /New plan/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.upload(within(dialog).getByLabelText('SOW or project charter'), pdf())
    await user.click(within(dialog).getByRole('button', { name: 'Generate plan' }))

    expect(await within(dialog).findByRole('status')).toHaveTextContent('Claude is reading the SOW')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(signal?.aborted).toBe(true)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Generate plan' })).toBeEnabled())
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Unsaved edits', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** Open the fixture plan, then delete a phase on the Timeline (an edit). */
  async function loadAndEdit(user: ReturnType<typeof userEvent.setup>) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (url === '/api/plans/open') return jsonResponse(PLAN_STATE)
        if (url === '/api/exports/plan-json') return fileResponse('{}', 'plan.json', 'application/json')
        const body = JSON.parse(init.body as string) as { edited: unknown[] }
        return jsonResponse({ phases: body.edited, status: PLAN_STATE.status })
      }),
    )
    await user.click(screen.getAllByRole('button', { name: 'Open plan.json' })[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.upload(within(dialog).getByLabelText('Saved plan'), new File([JSON.stringify(PROJECT)], 'plan.json'))
    await user.click(within(dialog).getByRole('button', { name: 'Open plan' }))
    await screen.findByRole('heading', { name: 'Saved plan' })
  }

  const unloadIsBlocked = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }

  it('warns before leaving only after the plan has been edited', async () => {
    const user = userEvent.setup()
    renderApp()
    await loadAndEdit(user)
    expect(unloadIsBlocked()).toBe(false)

    await user.click(screen.getByRole('button', { name: /^Timeline/ }))
    await user.click(screen.getByRole('button', { name: 'Delete Discovery' }))
    await waitFor(() => expect(screen.queryByLabelText('Task name for Discovery')).not.toBeInTheDocument())
    expect(unloadIsBlocked()).toBe(true)
  })

  it('stops warning once plan.json is downloaded, until the next edit', async () => {
    const names = captureDownloads()
    const user = userEvent.setup()
    renderApp()
    await loadAndEdit(user)
    await user.click(screen.getByRole('button', { name: /^Timeline/ }))
    await user.click(screen.getByRole('button', { name: 'Delete Discovery' }))
    await waitFor(() => expect(unloadIsBlocked()).toBe(true))

    await user.click(screen.getByRole('button', { name: /^Exports/ }))
    await user.click(screen.getByRole('button', { name: /Saved plan \(plan\.json\)/ }))
    await waitFor(() => expect(names).toEqual(['plan.json']))
    expect(unloadIsBlocked()).toBe(false)

    await user.click(screen.getByRole('button', { name: /^Timeline/ }))
    await user.click(screen.getByRole('button', { name: 'Delete Build' }))
    await waitFor(() => expect(unloadIsBlocked()).toBe(true))
  })

  it('asks before an edited plan is replaced', async () => {
    const user = userEvent.setup()
    renderApp()
    await loadAndEdit(user)
    await user.click(screen.getByRole('button', { name: /^Timeline/ }))
    await user.click(screen.getByRole('button', { name: 'Delete Discovery' }))
    await waitFor(() => expect(screen.queryByLabelText('Task name for Discovery')).not.toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: /New plan/ })[0]!)
    const confirm = await screen.findByRole('alertdialog', { name: 'Replace the current plan?' })
    await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByRole('dialog', { name: 'Plan from a SOW' })).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /New plan/ })[0]!)
    await user.click(await screen.findByRole('button', { name: 'Discard edits' }))
    expect(await screen.findByRole('dialog', { name: 'Plan from a SOW' })).toBeInTheDocument()
  })
})

describe('Open plan.json', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const openSheet = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByRole('button', { name: 'Open plan.json' })[0]!)
    return screen.findByRole('dialog', { name: 'Reopen a saved plan' })
  }

  it('reopens an original (Streamlit-era) plan.json using the chosen start date', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PLAN_STATE))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSheet(user)
    await user.upload(
      within(dialog).getByLabelText('Saved plan'),
      new File([JSON.stringify(PROJECT)], 'plan.json', { type: 'application/json' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Open plan' }))

    expect(await screen.findByRole('heading', { name: 'Saved plan' })).toBeInTheDocument()
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).plan).toEqual(PROJECT)
  })

  it('reopens a plan saved with edits, using its own name and start date', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(PLAN_STATE))
    vi.stubGlobal('fetch', fetchMock)
    const saved: PlanFile = {
      format: 'sow-architect/plan',
      version: 2,
      name: 'Northwind SOW',
      plan: PROJECT,
      schedule: { start_date: '2026-01-05', phases: PLAN_STATE.phases, sprints: PLAN_STATE.sprints, tasks: PLAN_STATE.tasks },
    }
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSheet(user)
    await user.upload(within(dialog).getByLabelText('Saved plan'), new File([JSON.stringify(saved)], 'plan.json'))

    expect(await within(dialog).findByRole('status')).toHaveTextContent('reopens exactly as saved, starting 5 Jan 2026')
    expect(within(dialog).queryByLabelText('Project start date')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Open plan' }))

    expect(await screen.findByRole('heading', { name: 'Northwind SOW' })).toBeInTheDocument()
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({ saved })
  })

  it('explains when the file is not valid JSON', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderApp()
    const dialog = await openSheet(user)
    await user.upload(within(dialog).getByLabelText('Saved plan'), new File(['{oops'], 'plan.json'))
    await user.click(within(dialog).getByRole('button', { name: 'Open plan' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("This file isn't valid JSON")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
