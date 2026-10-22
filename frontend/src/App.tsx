import { Suspense, lazy, useEffect } from 'react'
import { ROUTES, navigate, usePath } from './app/router'
import { AppShell } from './components/shell/AppShell'
import { ReporterStateProvider } from './portals/reporter/ReporterStateProvider'

// Each portal is its own chunk; the reporter's rich-text editor is the heaviest.
const ReporterPortal = lazy(() => import('./portals/reporter/ReporterPortal').then((m) => ({ default: m.ReporterPortal })))
const AdminPortal = lazy(() => import('./portals/admin/AdminPortal').then((m) => ({ default: m.AdminPortal })))
const QuorumPortal = lazy(() => import('./portals/quorum/QuorumPortal').then((m) => ({ default: m.QuorumPortal })))
const LandingPage = lazy(() => import('./landing/LandingPage').then((m) => ({ default: m.LandingPage })))
const SignInPage = lazy(() => import('./landing/SignInPage').then((m) => ({ default: m.SignInPage })))
const AuditLog = lazy(() => import('./portals/audit/AuditLog').then((m) => ({ default: m.AuditLog })))

const TITLES: Record<string, string> = {
  [ROUTES.home]: 'Report misconduct without standing alone',
  [ROUTES.signIn]: 'Sign in',
  [ROUTES.report]: 'Report misconduct',
  [ROUTES.admin]: 'Admin IT view',
  [ROUTES.quorum]: 'Steward quorum',
  [ROUTES.audit]: 'Public audit log',
}

export default function App() {
  const path = usePath()
  const known = path in TITLES
  useEffect(() => {
    if (!known) navigate(ROUTES.home, { replace: true })
  }, [known])

  useEffect(() => {
    document.title = TITLES[path] ? `${TITLES[path]} · SafeThreshold` : 'SafeThreshold'
  }, [path])

  if (path === ROUTES.home || path === ROUTES.signIn) {
    return (
      <Suspense fallback={null}>
        {path === ROUTES.home ? <LandingPage /> : <SignInPage />}
      </Suspense>
    )
  }

  return (
    <ReporterStateProvider>
      <AppShell path={path}>
        <Suspense fallback={<p className="text-[14px] text-slate">Loading…</p>}>
          {path === ROUTES.report && <ReporterPortal />}
          {path === ROUTES.admin && <AdminPortal />}
          {path === ROUTES.quorum && <QuorumPortal />}
          {path === ROUTES.audit && <AuditLog />}
        </Suspense>
      </AppShell>
    </ReporterStateProvider>
  )
}
