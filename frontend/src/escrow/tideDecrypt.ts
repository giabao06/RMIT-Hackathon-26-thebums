import type { OpenedReport } from './simulation'

export class PolicyPending extends Error {
  constructor(reportId: string) {
    super(`Report ${reportId} stays sealed until the Tide release policy is deployed.`)
  }
}

/**
 * The one place the investigator's device turns a sealed bundle into a report.
 * Replace the body with IAMService.doDecrypt (policy-governed VVK) once the Tide team deploys the
 * Forseti release policy. No key is ever held or rebuilt here (I-01); the simulation keys do not
 * apply to reports sealed through the real API.
 */
export async function decryptReport(sealed: { id: string; sealedAt: string; ciphertext: string }): Promise<OpenedReport> {
  throw new PolicyPending(sealed.id)
}
