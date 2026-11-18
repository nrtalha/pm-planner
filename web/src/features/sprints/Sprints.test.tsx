import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { PlanState } from '@/lib/types'
import { PLAN_STATE } from '@/test/fixtures'

import { Sprints } from './Sprints'

/** Holds state like App does, and records every change. */
function Harness({ onChange }: { onChange: (s: PlanState) => void }) {
  const [state, setState] = useState(PLAN_STATE)
  return (
    <Sprints
      state={state}
      onChange={(next) => {
        setState(next)
        onChange(next)
      }}
    />
  )
}

function setup() {
  const onChange = vi.fn<(s: PlanState) => void>()
  const user = userEvent.setup()
  render(<Harness onChange={onChange} />)
  const latest = () => onChange.mock.lastCall![0]
  const card = (name: string) => screen.getByRole('region', { name })
  return { user, onChange, latest, card }
}

describe('Sprints', () => {
  it('lists each sprint and the backlog with a summary, first sprint open', () => {
    const { card } = setup()
    expect(screen.getByText('2 tasks across 2 sprints and a backlog')).toBeInTheDocument()
    expect(within(card('Sprint 1')).getByRole('button', { name: /Sprint 1/, expanded: true })).toBeInTheDocument()
    expect(within(card('Sprint 2')).getByRole('button', { name: /Sprint 2/, expanded: false })).toBeInTheDocument()
    expect(within(card('Sprint 1')).getByText('5 Jan 2026 – 16 Jan 2026')).toBeInTheDocument()
    expect(within(card('Sprint 1')).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '0 of 1 tasks complete')
    expect(within(card('Backlog')).getByText('No dates')).toBeInTheDocument()
    expect(within(card('Sprint 1')).getByLabelText('Name for PDP design')).toHaveValue('PDP design')
  })

  it('expands and collapses sprints', async () => {
    const { user, card } = setup()
    await user.click(within(card('Sprint 2')).getByRole('button', { name: /^Sprint 2/ }))
    expect(within(card('Sprint 2')).getByLabelText('Name for API integration')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(within(card('Backlog')).getByText('No tasks in Backlog yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('adds a sprint before the backlog, opened', async () => {
    const { user, latest, card } = setup()
    await user.click(screen.getByRole('button', { name: 'Add sprint' }))
    expect(latest().sprints).toEqual(['Sprint 1', 'Sprint 2', 'Sprint 3', 'Backlog'])
    expect(within(card('Sprint 3')).getByText('No tasks in Sprint 3 yet.')).toBeInTheDocument()
  })

  it('deletes an empty sprint straight away', async () => {
    const { user, latest } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete Backlog' }))
    expect(latest().sprints).toEqual(['Sprint 1', 'Sprint 2'])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks before deleting a sprint that has tasks, then removes its tasks', async () => {
    const { user, onChange, latest } = setup()
    await user.click(screen.getByRole('button', { name: 'Delete Sprint 1' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Sprint 1?' })
    expect(dialog).toHaveTextContent('This removes the sprint and its 1 task.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete Sprint 1' }))
    await user.click(await screen.findByRole('button', { name: 'Delete sprint' }))
    expect(latest().sprints).toEqual(['Sprint 2', 'Backlog'])
    expect(latest().tasks.map((t) => t.id)).toEqual(['t2'])
  })

  it('edits a task name, status and priority', async () => {
    const { user, latest, card } = setup()
    const sprint1 = card('Sprint 1')
    const name = within(sprint1).getByLabelText('Name for PDP design')
    await user.clear(name)
    await user.type(name, 'PDP build{Enter}')
    expect(latest().tasks[0]!.name).toBe('PDP build')

    await user.selectOptions(within(sprint1).getByLabelText('Status for PDP build'), 'Complete')
    expect(latest().tasks[0]!.status).toBe('Complete')
    expect(within(sprint1).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 of 1 tasks complete')

    await user.selectOptions(within(sprint1).getByLabelText('Priority for PDP build'), 'Urgent')
    expect(latest().tasks[0]!.priority).toBe('Urgent')
  })

  it('refuses an empty task name', async () => {
    const { user, onChange, card } = setup()
    const name = within(card('Sprint 1')).getByLabelText('Name for PDP design')
    await user.clear(name)
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
    expect(name).toHaveValue('PDP design')
  })

  it('adds a task using the sprint dates, and deletes a task', async () => {
    const { user, latest, card } = setup()
    await user.click(within(card('Sprint 1')).getByRole('button', { name: 'Add task' }))
    expect(latest().tasks.at(-1)).toMatchObject({
      sprint: 'Sprint 1',
      name: 'New task',
      status: 'To-Do',
      start_date: '2026-01-05',
      due_date: '2026-01-16',
      priority: 'Normal',
    })

    await user.click(within(card('Sprint 1')).getByRole('button', { name: 'Delete task PDP design' }))
    expect(latest().tasks.map((t) => t.name)).toEqual(['API integration', 'New task'])
  })

  it('keeps a priority Claude invented', () => {
    const onChange = vi.fn()
    render(
      <Sprints
        state={{ ...PLAN_STATE, tasks: [{ ...PLAN_STATE.tasks[0]!, priority: 'Medium' }] }}
        onChange={onChange}
      />,
    )
    const select = screen.getByLabelText('Priority for PDP design')
    expect(select).toHaveValue('Medium')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Medium',
      'Urgent',
      'High',
      'Normal',
      'Low',
    ])
  })
})
