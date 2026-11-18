import { useCallback, useEffect, useState } from 'react'

export const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'sprints', label: 'Sprints' },
  { id: 'exports', label: 'Exports' },
] as const

export type ViewId = (typeof VIEWS)[number]['id']

const DEFAULT_VIEW: ViewId = 'overview'

function isViewId(value: string | null): value is ViewId {
  return VIEWS.some((v) => v.id === value)
}

function viewFromUrl(): ViewId {
  const value = new URLSearchParams(window.location.search).get('view')
  return isViewId(value) ? value : DEFAULT_VIEW
}

/** Current section, kept in ?view= so the browser's back button and reloads work. */
export function useView() {
  const [view, setViewState] = useState<ViewId>(viewFromUrl)

  useEffect(() => {
    const onPop = () => setViewState(viewFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const setView = useCallback((next: ViewId) => {
    setViewState(next)
    const url = new URL(window.location.href)
    url.searchParams.set('view', next)
    window.history.pushState(null, '', url)
  }, [])

  return { view, setView }
}
