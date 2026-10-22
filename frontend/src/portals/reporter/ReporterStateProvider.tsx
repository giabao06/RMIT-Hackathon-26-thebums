import { useState, type ReactNode } from 'react'
import { SCENARIO_PASSPHRASE, devScenario } from '@/app/scenarios'
import { useWorld } from '@/app/worldContext'
import { emptyDraft } from './draft'
import { ReporterStateContext, type ReporterState } from './reporterState'

export function ReporterStateProvider({ children }: { children: ReactNode }) {
  const { world, snapshot } = useWorld()
  const [state, setState] = useState<ReporterState>(() => {
    const first = snapshot.receipts[0]
    return {
      session: world.newReporterSession(),
      step: 0,
      draft: emptyDraft(),
      editorKey: 0,
      sealed: devScenario() && first ? { receipt: first, passphrase: SCENARIO_PASSPHRASE } : null,
    }
  })
  return <ReporterStateContext.Provider value={{ state, setState }}>{children}</ReporterStateContext.Provider>
}
