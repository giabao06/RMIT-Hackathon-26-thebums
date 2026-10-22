/**
 * The operator's server: the party SafeThreshold is designed not to trust.
 *
 * It stores what a real database would: ciphertext, the keyed matching token, a hash of the
 * withdrawal code and dates. It holds no key and no share, so a full dump of it reads nothing.
 * It also keeps its own steward table for display, which an admin can edit; the nodes ignore
 * it and use the registry they were given at setup.
 */
import { shortId, toHex, type Bytes } from './bytes'
import type { Sealed } from './crypto'
import { REPORT_THRESHOLD, type Approval } from './network'

export interface StoredReport {
  id: string
  caseId: string
  /** Keyed matching token. Used only for grouping; never returned by any read method here. */
  token: Bytes
  /**
   * SHA-256 of the token, shortened, for the admin view. It shows which rows are grouped
   * together, which the server already knows, and cannot be turned back into the token.
   */
  tokenDigest: string
  reporterTag: Bytes
  report: Sealed
  contact: Sealed | null
  attachments: Sealed[]
  /** Public salt for the reporter's withdrawal passphrase. The proof's hash lives on the nodes. */
  withdrawalSalt: Bytes
  createdAt: number
  expiresAt: number
}

export interface CaseSummary {
  caseId: string
  reportIds: string[]
  independentReporters: number
  eligible: boolean
}

/** One row of a database export, as an admin with full access would see it. */
export interface DumpRow {
  id: string
  caseId: string
  createdAt: number
  expiresAt: number
  ciphertextHex: string
  ciphertextBytes: number
  contactBytes: number
  attachmentBytes: number[]
  tokenDigest: string
}

export interface StewardTableRow {
  id: string
  seat: string
  fingerprint: string
  addedBy: 'setup' | 'admin'
}

export class OperatorServer {
  private readonly rows = new Map<string, StoredReport>()
  private readonly caseByToken = new Map<string, string>()
  readonly stewardTable: StewardTableRow[] = []
  readonly approvals = new Map<string, Approval[]>()

  store(input: Omit<StoredReport, 'caseId'>): string {
    const key = toHex(input.token)
    let caseId = this.caseByToken.get(key)
    if (!caseId) {
      caseId = shortId('K')
      this.caseByToken.set(key, caseId)
    }
    this.rows.set(input.id, { ...input, caseId })
    return caseId
  }

  has(id: string): boolean {
    return this.rows.has(id)
  }

  sealedReport(id: string): Sealed | null {
    return this.rows.get(id)?.report ?? null
  }

  sealedContact(id: string): Sealed | null {
    return this.rows.get(id)?.contact ?? null
  }

  sealedAttachments(id: string): Sealed[] {
    return this.rows.get(id)?.attachments ?? []
  }

  withdrawalSalt(id: string): Bytes | null {
    return this.rows.get(id)?.withdrawalSalt ?? null
  }

  createdAt(id: string): number | null {
    return this.rows.get(id)?.createdAt ?? null
  }

  caseOf(id: string): string | null {
    return this.rows.get(id)?.caseId ?? null
  }

  delete(id: string): void {
    const row = this.rows.get(id)
    if (!row) return
    this.rows.delete(id)
    // A case with no rows left is forgotten, so a later report about the same person does not
    // inherit an id that shows somebody reported them before.
    const key = toHex(row.token)
    if (![...this.rows.values()].some((r) => toHex(r.token) === key)) {
      this.caseByToken.delete(key)
      this.approvals.delete(row.caseId)
    }
  }

  deleteContact(id: string): void {
    const row = this.rows.get(id)
    if (row) row.contact = null
  }

  cases(): CaseSummary[] {
    const groups = new Map<string, StoredReport[]>()
    for (const row of this.rows.values()) {
      const list = groups.get(row.caseId) ?? []
      list.push(row)
      groups.set(row.caseId, list)
    }
    return [...groups.entries()].map(([caseId, list]) => {
      const independentReporters = new Set(list.map((r) => toHex(r.reporterTag))).size
      return {
        caseId,
        reportIds: list.map((r) => r.id),
        independentReporters,
        eligible: independentReporters >= REPORT_THRESHOLD,
      }
    })
  }

  /** What a database export would hand an admin. The token itself is never included. */
  dump(): DumpRow[] {
    return [...this.rows.values()].map((row) => ({
      id: row.id,
      caseId: row.caseId,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      ciphertextHex: toHex(row.report.ciphertext),
      ciphertextBytes: row.report.ciphertext.length,
      contactBytes: row.contact?.ciphertext.length ?? 0,
      attachmentBytes: row.attachments.map((a) => a.ciphertext.length),
      tokenDigest: row.tokenDigest,
    }))
  }

  /**
   * An attacker with the database can compare their own guesses against stored tokens.
   * This is that comparison, so the demo can show it finds nothing.
   */
  countTokenMatches(guesses: readonly Bytes[]): number {
    const stored = new Set([...this.rows.values()].map((r) => toHex(r.token)))
    return guesses.filter((g) => stored.has(toHex(g))).length
  }

  addApproval(caseId: string, approval: Approval): Approval[] {
    const list = this.approvals.get(caseId) ?? []
    if (!list.some((a) => a.stewardId === approval.stewardId)) list.push(approval)
    this.approvals.set(caseId, list)
    return list
  }
}
