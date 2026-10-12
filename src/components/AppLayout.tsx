import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Nav, MobileTabBar } from './Nav'
import { useAuth } from '../hooks/useAuth'
import { APP_VERSION } from '../lib/config'
import { InstallAppButton } from './InstallAppButton'

export function AppLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  // Start each new page at the top
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-taxi focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <Nav />
      <main id="main" className={`flex-1 ${user ? 'pb-24 md:pb-0' : ''}`}>
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  )
}

function Footer() {
  const { user } = useAuth()
  return (
    <footer className={`border-t border-line bg-card ${user ? 'hidden md:block' : ''}`}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:px-6">
        <span className="flex items-center gap-4">
          <span>Ride Along {APP_VERSION}</span>
          <InstallAppButton asLink />
        </span>
        <span>
          A product by{' '}
          <a href="https://asghinlabs.vercel.app/" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline decoration-taxi decoration-2 underline-offset-4 hover:decoration-ink">
            AsghinLabs
          </a>
        </span>
      </div>
    </footer>
  )
}

/** Centred container used by most pages. */
export function PageContainer({ children, width = 'lg' }: { children: ReactNode; width?: 'sm' | 'md' | 'lg' }) {
  const max = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-6xl' }[width]
  return <div className={`mx-auto ${max} px-4 py-6 sm:px-6 sm:py-10`}>{children}</div>
}
