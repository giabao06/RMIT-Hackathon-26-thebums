/**
 * Everything that touches the Tide SDK. Loaded only when a realm is configured, so the
 * simulation alone does not download it.
 */
import type { ReactNode } from 'react'
import { TideCloakContextProvider, useAuthCallback, useTideCloak } from '@tidecloak/react'
import { Button } from '@/components/ui/button'
import { signInAs, type Member } from './membership'
import { ROUTES, navigate } from './router'

const PORTAL_ROLES = ['reporter', 'steward', 'investigator', 'org-admin'] as const

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

/** The sign-in page's action when a realm is connected. The reporter API checks the role itself. */
export function TideSignIn({ member }: { member: Member }) {
  const { isInitializing, initError, authenticated, login, hasRealmRole } = useTideCloak()
  if (initError) return <span className="si-error">Tide unavailable: {initError.message}</span>
  if (isInitializing) return <span className="si-hint">Connecting to Tide…</span>
  if (!authenticated) {
    return (
      <button type="button" className="lp-btn" onClick={() => void login()}>
        Continue with Tide as {member}
      </button>
    )
  }
  if (!hasRealmRole('reporter')) {
    return <span className="si-error">This account has no reporter role yet. Ask the realm admin to grant it.</span>
  }
  return (
    <button
      type="button"
      className="lp-btn"
      onClick={() => {
        signInAs(member)
        navigate(ROUTES.report)
      }}
    >
      Go to the report form
    </button>
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
