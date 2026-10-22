import { createContext, useContext } from 'react'

/** Whether a TideCloak adapter config (public/tidecloak.json) was found at start-up. */
export const TideConfiguredContext = createContext(false)

export function useTideConfigured(): boolean {
  return useContext(TideConfiguredContext)
}

/**
 * Loads the adapter JSON exported by the realm bootstrap. Returns null when there is none:
 * the dev server answers a missing file with index.html, so the content type is checked.
 */
export async function loadTideConfig(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch('/tidecloak.json', { cache: 'no-store' })
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return null
    const config: unknown = await response.json()
    if (typeof config !== 'object' || config === null || !('realm' in config)) return null
    return config as Record<string, unknown>
  } catch {
    return null
  }
}
