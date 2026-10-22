import { Suspense, lazy } from 'react'
import { useTideConfigured } from './tideContext'

const ConnectedAccount = lazy(() => import('./TideConnected').then((m) => ({ default: m.ConnectedAccount })))
const ProcessCallback = lazy(() => import('./TideConnected').then((m) => ({ default: m.ProcessCallback })))

/** Sign-in state for the top bar. Without a realm it says so instead of pretending. */
export function TideAccount() {
  if (!useTideConfigured()) {
    return (
      <span className="text-[13px] text-chrome-muted" title="No public/tidecloak.json found. Run the realm bootstrap to connect TideCloak.">
        Tide realm not connected
      </span>
    )
  }
  return (
    <Suspense fallback={<span className="text-[13px] text-chrome-muted">Connecting to Tide…</span>}>
      <ConnectedAccount />
    </Suspense>
  )
}

/** /auth/redirect: finishes the OIDC code exchange after the Tide enclave hands back. */
export function AuthRedirect() {
  if (!useTideConfigured()) {
    return <p className="text-sm">TideCloak is not connected in this build, so there is no sign-in to finish.</p>
  }
  return (
    <Suspense fallback={<p className="text-sm text-slate">Completing sign-in…</p>}>
      <ProcessCallback />
    </Suspense>
  )
}
