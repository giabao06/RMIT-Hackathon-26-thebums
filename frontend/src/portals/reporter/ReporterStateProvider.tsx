import { useState, type ReactNode } from 'react'
import { emptyDraft } from './draft'
import { ReporterStateContext, type ReporterState } from './reporterState'

export function ReporterStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReporterState>(() => ({ step: 0, draft: emptyDraft(), editorKey: 0, sealed: null }))
  return <ReporterStateContext.Provider value={{ state, setState }}>{children}</ReporterStateContext.Provider>
}
