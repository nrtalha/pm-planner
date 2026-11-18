import { useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { SideNav } from '@/components/layout/SideNav'
import { TopBar } from '@/components/layout/TopBar'
import { EmptyState } from '@/features/empty/EmptyState'
import { Exports } from '@/features/exports/Exports'
import { Overview } from '@/features/overview/Overview'
import { NewPlanSheet } from '@/features/plan/NewPlanSheet'
import { OpenPlanSheet } from '@/features/plan/OpenPlanSheet'
import { ReplacePlanDialog } from '@/features/plan/ReplacePlanDialog'
import { Sprints } from '@/features/sprints/Sprints'
import { Timeline } from '@/features/timeline/Timeline'
import type { LoadedPlan, PlanState } from '@/lib/types'
import { useTheme } from '@/lib/theme'
import { useUnsavedChangesWarning } from '@/lib/useUnsavedChangesWarning'
import { useView, type ViewId } from '@/lib/views'

type PanelName = 'new' | 'open'

type SectionProps = {
  view: ViewId
  plan: LoadedPlan
  onChange: (s: PlanState) => void
  onSaved: () => void
}

function Section({ view, plan, onChange, onSaved }: SectionProps) {
  switch (view) {
    case 'overview':
      return <Overview plan={plan} />
    case 'timeline':
      return <Timeline state={plan.state} onChange={onChange} />
    case 'sprints':
      return <Sprints state={plan.state} onChange={onChange} />
    case 'exports':
      return <Exports plan={plan} onSaved={onSaved} />
  }
}

export default function App() {
  const { theme, toggle } = useTheme()
  const { view, setView } = useView()
  const [plan, setPlan] = useState<LoadedPlan | null>(null)
  /** True once the loaded plan has been edited; cleared when a plan is loaded or plan.json is downloaded. */
  const [dirty, setDirty] = useState(false)
  const [panel, setPanel] = useState<PanelName | null>(null)
  const [confirmPanel, setConfirmPanel] = useState<PanelName | null>(null)

  useUnsavedChangesWarning(dirty)

  const requestPanel = (name: PanelName) => (dirty ? setConfirmPanel(name) : setPanel(name))
  const closePanel = (open: boolean) => {
    if (!open) setPanel(null)
  }
  const loaded = (next: LoadedPlan) => {
    setPlan(next)
    setDirty(false)
    setView('overview')
  }
  const edited = (state: PlanState) => {
    setPlan((current) => (current ? { ...current, state } : current))
    setDirty(true)
  }

  const counts = plan
    ? {
        overview: String(plan.state.project.key_risks.length),
        timeline: String(plan.state.phases.length),
        sprints: String(plan.state.tasks.length),
      }
    : undefined

  return (
    <>
      <AppShell
        topBar={
          <TopBar
            planName={plan?.name ?? null}
            theme={theme}
            onToggleTheme={toggle}
            onNewPlan={() => requestPanel('new')}
            onOpenPlan={() => requestPanel('open')}
          />
        }
        sideNav={<SideNav current={view} onSelect={setView} counts={counts} />}
      >
        {plan ? (
          <Section view={view} plan={plan} onChange={edited} onSaved={() => setDirty(false)} />
        ) : (
          <EmptyState onNewPlan={() => requestPanel('new')} onOpenPlan={() => requestPanel('open')} />
        )}
      </AppShell>
      <NewPlanSheet open={panel === 'new'} onOpenChange={closePanel} onLoaded={loaded} />
      <OpenPlanSheet open={panel === 'open'} onOpenChange={closePanel} onLoaded={loaded} />
      <ReplacePlanDialog
        open={confirmPanel !== null}
        onCancel={() => setConfirmPanel(null)}
        onConfirm={() => {
          setPanel(confirmPanel)
          setConfirmPanel(null)
        }}
      />
    </>
  )
}
