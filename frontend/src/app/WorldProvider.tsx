import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { EscrowWorld } from '@/escrow/simulation'
import { devScenario, runScenario } from './scenarios'
import { WorldContext } from './worldContext'

/**
 * Creates the simulated escrow (server, five nodes, three stewards) for this tab. It lives in
 * memory only: reloading the page starts a fresh, empty escrow.
 */
export function WorldProvider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<EscrowWorld | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let cancelled = false
    EscrowWorld.create()
      .then(async (w) => {
        const scenario = devScenario()
        if (scenario) await runScenario(w, scenario)
        if (!cancelled) setWorld(w)
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      cancelled = true
    }
  }, [])

  const reset = useCallback(async () => {
    setWorld(await EscrowWorld.create())
    setGeneration((g) => g + 1)
  }, [])

  const value = useMemo(() => (world ? { world, reset } : null), [world, reset])

  if (error) {
    return (
      <p role="alert" className="p-6 text-sm">
        This browser could not start the encryption engine: {error}. SafeThreshold needs WebCrypto,
        which every current browser has on https and on localhost.
      </p>
    )
  }
  if (!value) {
    return <p className="p-6 text-sm text-slate">Generating steward and node keys…</p>
  }
  // Keyed by generation, so a reset remounts every portal and no stale receipt survives it.
  return (
    <WorldContext.Provider value={value}>
      <Fragment key={generation}>{children}</Fragment>
    </WorldContext.Provider>
  )
}
