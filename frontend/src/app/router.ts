/** A minimal path router: four portals do not need a routing library. */
import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname)
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === window.location.pathname) return
  if (options.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  for (const listener of listeners) listener()
  window.scrollTo({ top: 0 })
}

export const ROUTES = {
  report: '/report',
  admin: '/admin',
  quorum: '/quorum',
  audit: '/audit',
  authRedirect: '/auth/redirect',
} as const
