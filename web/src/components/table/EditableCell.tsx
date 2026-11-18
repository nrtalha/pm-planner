import { useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

type EditableCellProps = {
  /** Accessible name, e.g. "Duration (weeks) for Discovery". */
  label: string
  type: 'text' | 'number' | 'date'
  value: string
  onCommit: (value: string) => void
  isValid?: (value: string) => boolean
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
}

/**
 * Spreadsheet-style cell: looks like text until hovered or focused.
 * Commits on Enter or blur (dates commit as soon as a full date is picked); Escape reverts.
 * Keyed on the saved value, so the draft resets whenever the schedule comes back from the API.
 */
export function EditableCell(props: EditableCellProps) {
  return <EditableCellInput key={props.value} {...props} />
}

function EditableCellInput({ label, type, value, onCommit, isValid, min, max, step, disabled, className }: EditableCellProps) {
  const [draft, setDraft] = useState(value)
  // The last value sent, so a date picked (commits on change) isn't sent again on blur.
  const committed = useRef(value)

  const valid = isValid ? isValid(draft) : true

  const commit = (next = draft) => {
    if (next === committed.current) return
    if (isValid && !isValid(next)) {
      setDraft(value)
      return
    }
    committed.current = next
    onCommit(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    if (event.key === 'Enter') input.blur()
    if (event.key === 'Escape') {
      setDraft(value)
      committed.current = value
      requestAnimationFrame(() => input.blur())
    }
  }

  return (
    <input
      type={type}
      aria-label={label}
      aria-invalid={!valid || undefined}
      value={draft}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => {
        setDraft(event.target.value)
        if (type === 'date' && event.target.value) commit(event.target.value)
      }}
      onBlur={() => commit()}
      onKeyDown={onKeyDown}
      className={cn(
        'h-9 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-sm transition-colors outline-none',
        'hover:border-input focus-visible:border-ring focus-visible:bg-field focus-visible:ring-3 focus-visible:ring-ring/40',
        'aria-invalid:border-destructive disabled:opacity-60',
        className,
      )}
    />
  )
}
