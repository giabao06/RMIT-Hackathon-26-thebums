/**
 * Everything that touches the Tide SDK. Loaded only when a realm is configured, so the
 * simulation alone does not download it.
 */
import type { ReactNode } from 'react'
import { TideCloakContextProvider, useAuthCallback, useTideCloak } from '@tidecloak/react'
import { Button } from '@/components/ui/button'
import { ROUTES } from './router'

const PORTAL_ROLES = ['reporter', 'steward', 'investigator'] as const

export function TideProvider({ config, children }: { config: Record<string, unknown>; children: ReactNode }) {
  // useDPoP goes inside config, not as a JSX prop, or DPoP is silently off.
  return (
    <TideCloakContextProvider config={{ ...config, useDPoP: { mode: 'strict', alg: 'ES256' } }}>
      {children}
    </TideCloakContextProvider>
  )
}

export function ConnectedAccount() {
  const { isInitializing, initError, authenticated, login, logout, hasRealmRole } = useTideCloak()
  if (initError) return <span className="text-[13px] text-danger-ink">Tide unavailable: {initError.message}</span>
  if (isInitializing) return <span className="text-[13px] text-chrome-muted">Connecting to Tide…</span>
  if (!authenticated) {
    return (
      <Button variant="outline" size="sm" onClick={() => void login()}>
        Sign in with Tide
      </Button>
    )
  }
  // UI hint only. Every real decision is made by the server and the Tide network.
  const roles = PORTAL_ROLES.filter((role) => hasRealmRole(role))
  return (
    <span className="flex items-center gap-3 text-[13px]">
      <span className="text-chrome-muted">Tide account · {roles.length ? roles.join(', ') : 'no portal role yet'}</span>
      <Button variant="ghost" size="sm" onClick={() => void logout()}>
        Sign out
      </Button>
    </span>
  )
}

export function ProcessCallback() {
  const { isProcessing, error } = useAuthCallback({
    onSuccess: (returnUrl) => window.location.assign(returnUrl || ROUTES.report),
    onError: () => window.location.assign(ROUTES.report),
    onMissingVerifierRedirectTo: ROUTES.report,
  })
  if (error) return <p role="alert" className="text-sm text-danger-ink">Sign-in failed: {error.message}</p>
  return <p className="text-sm text-slate">{isProcessing ? 'Completing sign-in…' : 'Redirecting…'}</p>
}
