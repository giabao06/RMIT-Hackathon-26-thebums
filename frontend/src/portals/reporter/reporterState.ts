import { createContext, useContext } from 'react'
import type { Receipt } from '@/escrow/types'
import type { Draft } from './draft'

export interface ReporterState {
  step: number
  draft: Draft
  editorKey: number
  sealed: { receipt: Receipt; passphrase: string } | null
}

export interface ReporterStateValue {
  state: ReporterState
  setState: (update: (s: ReporterState) => ReporterState) => void
}

export const ReporterStateContext = createContext<ReporterStateValue | null>(null)

/**
 * The reporter's wizard, kept in memory for this tab only so moving between portals does not
 * lose it. Never written to storage: a report draft must not outlive the tab on a shared device.
 */
export function useReporterState(): ReporterStateValue {
  const value = useContext(ReporterStateContext)
  if (!value) throw new Error('useReporterState must be used inside ReporterStateProvider')
  return value
}
