import { CalendarRange, Download, KanbanSquare, LayoutDashboard, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { VIEWS, type ViewId } from '@/lib/views'

const ICONS: Record<ViewId, LucideIcon> = {
  overview: LayoutDashboard,
  timeline: CalendarRange,
  sprints: KanbanSquare,
  exports: Download,
}

type SideNavProps = {
  current: ViewId
  onSelect: (view: ViewId) => void
  /** Optional count shown beside each section (e.g. tasks); hidden when absent. */
  counts?: Partial<Record<ViewId, string>>
}

export function SideNav({ current, onSelect, counts = {} }: SideNavProps) {
  return (
    <nav
      aria-label="Plan sections"
      className="flex flex-row gap-1 overflow-x-auto border-b border-border p-3 lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-b-0 lg:p-4"
    >
      <span className="eyebrow hidden px-3 pt-1 pb-2 lg:block">Plan</span>
      {VIEWS.map(({ id, label }) => {
        const Icon = ICONS[id]
        const active = id === current
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 shrink-0 items-center gap-3 rounded-full px-3 text-sm font-medium transition-colors',
              'outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="flex-1 text-left">{label}</span>
            {counts[id] && (
              <span className={cn('font-mono text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {counts[id]}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
