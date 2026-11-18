import type { ReactNode } from 'react'

type AppShellProps = {
  topBar: ReactNode
  sideNav: ReactNode
  children: ReactNode
}

/** Top bar over a side menu + content row. The menu becomes a scrollable strip below 1024px. */
export function AppShell({ topBar, sideNav, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {topBar}
      <div className="flex flex-1 flex-col lg:flex-row">
        {sideNav}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
