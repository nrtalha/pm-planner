import { FileJson, Moon, Plus, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Theme } from '@/lib/theme'

type TopBarProps = {
  planName: string | null
  theme: Theme
  onToggleTheme: () => void
  /** Omitted until the plan panels exist (step 4); the buttons render disabled. */
  onNewPlan?: () => void
  onOpenPlan?: () => void
}

export function TopBar({ planName, theme, onToggleTheme, onNewPlan, onOpenPlan }: TopBarProps) {
  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <header className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M4 7h9M8 12h12M4 17h8" />
          </svg>
        </span>
        <span className="font-heading text-base font-bold text-heading">SOW Architect</span>
      </div>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-2 text-sm text-muted-foreground">
          <li>Plans</li>
          {planName && (
            <>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="truncate font-medium text-foreground">
                {planName}
              </li>
            </>
          )}
        </ol>
      </nav>

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label={themeLabel}>
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{themeLabel}</TooltipContent>
        </Tooltip>
        <Button variant="outline" onClick={onOpenPlan} disabled={!onOpenPlan}>
          <FileJson data-icon="inline-start" />
          Open plan.json
        </Button>
        <Button onClick={onNewPlan} disabled={!onNewPlan}>
          <Plus data-icon="inline-start" />
          New plan
        </Button>
      </div>
    </header>
  )
}
