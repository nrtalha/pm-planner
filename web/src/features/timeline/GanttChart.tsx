import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDate, plural } from '@/lib/format'
import type { Gantt } from '@/lib/gantt'
import { cn } from '@/lib/utils'

import { phaseBg } from './phaseColors'

const LABEL_COL = 'w-48 shrink-0 pr-4 sm:w-56'

function weeksText(weeks: number) {
  return Number.isInteger(weeks) ? plural(weeks, 'week') : `${weeks} weeks`
}

export function GanttChart({ gantt, deadline }: { gantt: Gantt | null; deadline: string }) {
  return (
    <section aria-labelledby="gantt-title" className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id="gantt-title" className="eyebrow">
          Gantt chart
        </h2>
        {gantt && (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
            {gantt.legend.map(({ phase, colorIndex }) => (
              <li key={phase} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('size-2.5 rounded-sm', phaseBg(colorIndex))} />
                {phase}
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-destructive" />
              Deadline · {formatDate(deadline)}
            </li>
          </ul>
        )}
      </div>

      {!gantt ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          Phases need a start date and a duration to appear on the chart.
        </p>
      ) : (
        <div className="overflow-x-auto px-5 pt-3 pb-5">
          <div className="min-w-[760px]" role="group" aria-label="Gantt chart of the phase schedule">
            <div className="flex border-b border-border pb-2 text-[11px] text-muted-foreground">
              <div className={LABEL_COL} />
              <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${gantt.weeks.length}, minmax(0, 1fr))` }}>
                {gantt.weeks.map((w) => (
                  <span key={w} className="font-mono">
                    {w}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              {gantt.bars.map((bar) => (
                <div key={bar.id} className="flex h-12 items-center border-b border-border/60 last:border-b-0">
                  <div className={cn(LABEL_COL, 'truncate text-sm')} title={bar.label}>
                    {bar.label}
                  </div>
                  <div
                    className="relative h-full flex-1"
                    style={{
                      backgroundImage: 'linear-gradient(to right, var(--border) 1px, transparent 1px)',
                      backgroundSize: `${100 / gantt.weeks.length}% 100%`,
                    }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          tabIndex={0}
                          aria-label={`${bar.label}: ${bar.phase}, ${weeksText(bar.durationWeeks)}, ${formatDate(bar.start)} to ${formatDate(bar.end)}`}
                          className={cn(
                            'absolute top-1/2 h-6 -translate-y-1/2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
                            phaseBg(bar.colorIndex),
                          )}
                          style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="flex flex-col gap-0.5">
                        <span className="font-semibold">{bar.label}</span>
                        <span>
                          {bar.phase} · {weeksText(bar.durationWeeks)}
                        </span>
                        <span>
                          {formatDate(bar.start)} → {formatDate(bar.end)}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}

              {/* Deadline line, positioned over the bar area only. */}
              <div className="pointer-events-none absolute inset-y-0 right-0 left-48 sm:left-56" aria-hidden="true">
                <div
                  className="absolute inset-y-0 border-l-2 border-dashed border-destructive"
                  style={{ left: `${gantt.deadlinePct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
