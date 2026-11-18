import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom has no ResizeObserver; Radix (tooltips, popovers) needs one. Browsers all have it.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom has no object URLs; downloads only need a placeholder string.
if (!('createObjectURL' in URL)) {
  Object.assign(URL, { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} })
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  document.documentElement.className = 'dark'
  window.history.replaceState(null, '', '/')
})
