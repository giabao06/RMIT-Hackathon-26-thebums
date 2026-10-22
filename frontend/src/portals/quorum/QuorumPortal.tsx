import { Suspense, lazy } from 'react'
import { useTideCloak } from '@tidecloak/react'

const StewardLive = lazy(() => import('./StewardLive').then((m) => ({ default: m.StewardLive })))
const InvestigatorLive = lazy(() => import('./InvestigatorLive').then((m) => ({ default: m.InvestigatorLive })))
const API_URL = import.meta.env.VITE_API_URL as string | undefined

/** Stewards and investigators use the real backend. */
export function QuorumPortal() {
  if (!API_URL) return <p role="alert" className="text-[14px] text-danger-ink">VITE_API_URL is not set, so the steward portal has no backend.</p>
  return (
    <Suspense fallback={<p className="text-[14px] text-slate">Connecting to Tide…</p>}>
      <LiveQuorum apiUrl={API_URL} />
    </Suspense>
  )
}

// UI routing only; the API checks the role on every request.
function LiveQuorum({ apiUrl }: { apiUrl: string }) {
  const { authenticated, hasRealmRole } = useTideCloak()
  return authenticated && hasRealmRole('investigator') && !hasRealmRole('steward') ? (
    <InvestigatorLive apiUrl={apiUrl} />
  ) : (
    <StewardLive apiUrl={apiUrl} />
  )
}
