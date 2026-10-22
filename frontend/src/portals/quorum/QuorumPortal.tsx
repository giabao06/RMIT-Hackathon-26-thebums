import { Suspense, lazy, useEffect, useState } from 'react'
import { useAuth } from '@/app/auth'

const StewardLive = lazy(() => import('./StewardLive').then((m) => ({ default: m.StewardLive })))
const InvestigatorLive = lazy(() => import('./InvestigatorLive').then((m) => ({ default: m.InvestigatorLive })))
const API_URL = import.meta.env.VITE_API_URL as string | undefined

/** Stewards and investigators use the real backend. */
export function QuorumPortal() {
  if (!API_URL) return <p role="alert" className="text-[14px] text-danger-ink">VITE_API_URL is not set, so the steward portal has no backend.</p>
  return (
    <Suspense fallback={<p className="text-[14px] text-slate">Loading…</p>}>
      <RoleSwitch apiUrl={API_URL} />
    </Suspense>
  )
}

// Which view to show is a UI choice only: each API checks the role on every request.
function RoleSwitch({ apiUrl }: { apiUrl: string }) {
  const { loading, session, secureFetch } = useAuth()
  const [role, setRole] = useState<'steward' | 'investigator' | 'none' | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      for (const r of ['steward', 'investigator'] as const) {
        if ((await secureFetch(`${apiUrl}/${r}/key`)).ok) return !cancelled && setRole(r)
      }
      if (!cancelled) setRole('none')
    })()
    return () => {
      cancelled = true
    }
  }, [userId, apiUrl, secureFetch])

  if (loading || (userId && role === null)) return <p className="text-[14px] text-slate">Loading…</p>
  if (!userId || role === 'steward') return <StewardLive apiUrl={apiUrl} />
  if (role === 'investigator') return <InvestigatorLive apiUrl={apiUrl} />
  return <p role="alert" className="text-[14px] text-danger-ink">This account is neither a steward nor an investigator. Ask an org admin to add you.</p>
}
