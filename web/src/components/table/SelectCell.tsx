import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type SelectCellProps = {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  disabled?: boolean
  /** Rendered before the select, e.g. a coloured dot. */
  adornment?: ReactNode
}

/**
 * Native <select> styled like EditableCell: keyboard, screen-reader and mobile friendly.
 * A value that is not in `options` (e.g. a priority Claude invented) is kept and shown.
 */
export function SelectCell({ label, value, options, onChange, disabled, adornment }: SelectCellProps) {
  const choices = value && !options.includes(value) ? [value, ...options] : options
  return (
    <div className="relative flex items-center">
      {adornment && <span className="pointer-events-none absolute left-2 flex">{adornment}</span>}
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-9 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent pr-7 pl-2 text-sm transition-colors outline-none',
          'hover:border-input focus-visible:border-ring focus-visible:bg-field focus-visible:ring-3 focus-visible:ring-ring/40',
          'disabled:opacity-60 [&>option]:bg-popover [&>option]:text-popover-foreground',
          adornment && 'pl-6',
        )}
      >
        {!value && <option value="">—</option>}
        {choices.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
