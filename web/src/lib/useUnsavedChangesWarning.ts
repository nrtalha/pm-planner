import { useEffect } from 'react'

/**
 * While `active`, the browser asks for confirmation before the tab is closed, reloaded or
 * navigated away. Browsers show their own generic wording; custom text is not allowed.
 */
export function useUnsavedChangesWarning(active: boolean) {
  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Older Chromium-based browsers still need returnValue set.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])
}
