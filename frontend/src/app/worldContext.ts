import { createContext, useContext, useSyncExternalStore } from 'react'
import type { EscrowWorld, WorldSnapshot } from '@/escrow/simulation'

export interface WorldContextValue {
  world: EscrowWorld
  reset: () => Promise<void>
}

export const WorldContext = createContext<WorldContextValue | null>(null)

/** The simulation and a live snapshot of it. */
export function useWorld(): WorldContextValue & { snapshot: WorldSnapshot } {
  const value = useContext(WorldContext)
  if (!value) throw new Error('useWorld must be used inside WorldProvider')
  const snapshot = useSyncExternalStore(value.world.subscribe, value.world.getSnapshot)
  return { ...value, snapshot }
}
