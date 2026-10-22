/**
 * Development only: preset states for screenshots and rehearsals, loaded with ?scenario=<name>.
 * Every call is guarded by import.meta.env.DEV, so production builds drop this path.
 */
import { SAMPLE_REPORTS } from '@/escrow/samples'
import type { EscrowWorld, Receipt } from '@/escrow/simulation'

export const SCENARIO_PASSPHRASE = 'scenario passphrase'

export type ScenarioName = 'sealed' | 'matched' | 'partial' | 'released' | 'attacked'

export function devScenario(): ScenarioName | null {
  if (!import.meta.env.DEV) return null
  const name = new URLSearchParams(window.location.search).get('scenario')
  return ['sealed', 'matched', 'partial', 'released', 'attacked'].includes(name ?? '') ? (name as ScenarioName) : null
}

export async function runScenario(world: EscrowWorld, name: ScenarioName): Promise<Receipt> {
  const submit = (i: 0 | 1) =>
    world.submitReport(world.newReporterSession(), {
      ...SAMPLE_REPORTS[i],
      attachments: [],
      lifespanMonths: 12,
      passphrase: SCENARIO_PASSPHRASE,
    })
  const first = await submit(0)
  if (name === 'sealed') return first
  await submit(1)
  const caseId = world.getSnapshot().cases[0].caseId
  if (name === 'partial' || name === 'released') {
    await world.approve('student-union', caseId)
    if (name === 'partial') world.hold('inspectorate')
    else await world.approve('inspectorate', caseId)
  }
  if (name === 'attacked') await world.forceDecrypt(caseId)
  return first
}
