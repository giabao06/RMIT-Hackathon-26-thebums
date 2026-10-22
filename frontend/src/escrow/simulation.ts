/**
 * The escrow simulation: every party in one place, so the demo can show what each of them
 * sees and can do. The cryptography is real (AES-256-GCM, HMAC-SHA-256, PBKDF2, ECDSA P-256,
 * Shamir over GF(256)); the node network is simulated in this browser tab. network.ts lists
 * the two simplifications against the production design.
 */
import type { RemoteReports } from './remote'
import { fromUtf8, randomBytes, shortId, toHex, utf8, type Bytes } from './bytes'
import {
  fingerprint,
  generateSigningKeys,
  open,
  passphraseProof,
  seal,
  sha256,
  sign,
  type Sealed,
} from './crypto'
import {
  NODE_COUNT,
  NodeNetwork,
  REPORT_THRESHOLD,
  SHARE_THRESHOLD,
  STEWARD_QUORUM,
  releaseMessage,
  type Approval,
  type NodeVerdict,
} from './network'
import { isRichDoc, plainText, type RichDoc } from './richDoc'
import { DIRECTORY_GUESSES } from './samples'
import { OperatorServer, type CaseSummary, type DumpRow, type StewardTableRow } from './server'
import { combine, split, type Share } from './shamir'
import { canonicalSubject, normaliseIdentifier, normaliseName, type Subject } from './subject'

export const LIFESPAN_OPTIONS = [12, 15, 18] as const
export const MAX_ATTACHMENTS = 3
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MIN_PASSPHRASE_LENGTH = 8
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

export const STEWARD_SEATS = [
  { id: 'student-union', seat: 'Student Union' },
  { id: 'independent-ngo', seat: 'Independent NGO' },
  { id: 'inspectorate', seat: 'Inspectorate' },
] as const

export type StewardId = (typeof STEWARD_SEATS)[number]['id']

export class InputError extends Error {}

export interface AttachmentInput {
  name: string
  type: string
  data: Bytes
}

export interface ReportInput {
  subject: Subject
  incidentDate: string
  content: RichDoc
  attachments: AttachmentInput[]
  contact: string
  lifespanMonths: number
  passphrase: string
}

export interface Receipt {
  reportId: string
  sealedBytes: number
  attachmentCount: number
  sealedAt: number
  expiresAt: number
  lifespanMonths: number
  status: 'sealed' | 'withdrawn' | 'contact-removed' | 'expired'
}

export interface AuditEntry {
  seq: number
  at: number
  actor: string
  action: string
  detail: string
  tone: 'neutral' | 'refused' | 'released'
}

export interface VerdictBatch {
  seq: number
  at: number
  submittedBy: string
  caseId: string
  signers: string[]
  verdicts: { node: number; released: boolean; reason: string }[]
  released: boolean
}

export interface OpenedAttachment {
  name: string
  type: string
  data: Bytes
}

export interface OpenedReport {
  reportId: string
  sealedAt: number
  incidentDate: string
  content: RichDoc
  attachments: OpenedAttachment[]
  contact: string | null
  combinedFrom: number[]
}

export interface AttackResult {
  seq: number
  at: number
  kind: 'dump' | 'dictionary' | 'force-decrypt'
  title: string
  outcome: string
  batch?: VerdictBatch
}

export type StewardStance = 'waiting' | 'approved' | 'holding'

export interface WorldSnapshot {
  version: number
  now: number
  monthsAdvanced: number
  rows: DumpRow[]
  cases: CaseSummary[]
  receipts: Receipt[]
  stewards: { id: StewardId; seat: string; fingerprint: string; stance: StewardStance }[]
  stewardTable: StewardTableRow[]
  approvals: Record<string, string[]>
  batches: VerdictBatch[]
  opened: Record<string, OpenedReport[]>
  audit: AuditEntry[]
  attacks: AttackResult[]
  nodeShares: { node: number; shares: number }[]
}

interface Steward {
  id: StewardId
  seat: string
  keys: CryptoKeyPair
  fingerprint: string
  stance: StewardStance
}

interface ReportPlaintext {
  incidentDate: string
  content: RichDoc
  attachments: { name: string; type: string; size: number }[]
}

export class EscrowWorld {
  /** Set when a backend is configured; the report is also sent there. */
  remote: RemoteReports | null = null
  private readonly server = new OperatorServer()
  private readonly network: NodeNetwork
  private readonly stewards: Steward[]
  private readonly receipts: Receipt[] = []
  private readonly audit: AuditEntry[] = []
  private readonly batches: VerdictBatch[] = []
  private readonly attacks: AttackResult[] = []
  private readonly opened = new Map<string, OpenedReport[]>()
  private adminKeys: CryptoKeyPair | null = null
  private readonly startedAt: number
  private monthsAdvanced = 0
  private seq = 0
  private version = 0
  private snapshot: WorldSnapshot
  private readonly listeners = new Set<() => void>()

  private constructor(stewards: Steward[], startedAt: number) {
    this.stewards = stewards
    this.startedAt = startedAt
    this.network = new NodeNetwork(stewards.map((s) => ({ id: s.id, publicKey: s.keys.publicKey })))
    for (const s of stewards) {
      this.server.stewardTable.push({ id: s.id, seat: s.seat, fingerprint: s.fingerprint, addedBy: 'setup' })
    }
    this.log(
      'Setup',
      'Pinned the steward registry',
      `${stewards.length} seats; any ${STEWARD_QUORUM} can open an eligible case. Each of the ${NODE_COUNT} nodes keeps its own copy.`,
    )
    this.snapshot = this.buildSnapshot()
  }

  static async create(startedAt = Date.now()): Promise<EscrowWorld> {
    const stewards = await Promise.all(
      STEWARD_SEATS.map(async ({ id, seat }) => {
        const keys = await generateSigningKeys()
        return { id, seat, keys, fingerprint: await fingerprint(keys.publicKey), stance: 'waiting' as const }
      }),
    )
    return new EscrowWorld(stewards, startedAt)
  }

  // ---- subscription, for useSyncExternalStore ----

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): WorldSnapshot => this.snapshot

  private changed(): void {
    this.version++
    this.snapshot = this.buildSnapshot()
    for (const listener of this.listeners) listener()
  }

  now(): number {
    return this.startedAt + this.monthsAdvanced * MONTH_MS
  }

  private log(actor: string, action: string, detail: string, tone: AuditEntry['tone'] = 'neutral'): void {
    this.audit.push({ seq: ++this.seq, at: this.now(), actor, action, detail, tone })
  }

  // ---- the reporter's device ----

  /** A new anonymous reporter. Two sessions count as two independent reporters. */
  newReporterSession(): string {
    return `reporter-${toHex(randomBytes(16))}`
  }

  /**
   * Seals a report on the reporter's device and sends it. The device encrypts the report and
   * its files, splits the key across the nodes, and keeps the passphrase. It never receives
   * the matching token.
   */
  async submitReport(reporterSession: string, input: ReportInput): Promise<Receipt> {
    const canonical = canonicalSubject(input.subject) // throws SubjectError on missing fields
    if (!plainText(input.content).trim()) throw new InputError('Describe what happened.')
    if (!(LIFESPAN_OPTIONS as readonly number[]).includes(input.lifespanMonths)) {
      throw new InputError(`Choose a lifespan of ${LIFESPAN_OPTIONS.join(', ')} months.`)
    }
    if (input.passphrase.length < MIN_PASSPHRASE_LENGTH) {
      throw new InputError(`Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`)
    }
    if (input.attachments.length > MAX_ATTACHMENTS) {
      throw new InputError(`Attach at most ${MAX_ATTACHMENTS} files.`)
    }
    if (input.attachments.some((a) => a.data.length > MAX_ATTACHMENT_BYTES)) {
      throw new InputError('Each file must be 5 MB or smaller.')
    }

    const reportId = shortId('R')
    const dataKey = randomBytes(32)
    const body: ReportPlaintext = {
      incidentDate: input.incidentDate,
      content: input.content,
      attachments: input.attachments.map((a) => ({ name: a.name, type: a.type, size: a.data.length })),
    }
    const report = await seal(dataKey, utf8(JSON.stringify(body)), utf8(reportId))
    const contactText = input.contact.trim()
    const contact = contactText ? await seal(dataKey, utf8(contactText), utf8(`${reportId}|contact`)) : null
    const attachments: Sealed[] = []
    for (const [i, file] of input.attachments.entries()) {
      attachments.push(await seal(dataKey, file.data, utf8(`${reportId}|file|${i}`)))
    }
    const shares = split(dataKey, NODE_COUNT, SHARE_THRESHOLD)
    dataKey.fill(0)

    const withdrawalSalt = randomBytes(16)
    const withdrawalHash = await sha256(await passphraseProof(input.passphrase, withdrawalSalt))
    const createdAt = this.now()
    const expiresAt = createdAt + input.lifespanMonths * MONTH_MS

    await this.remote?.submit({
      reportId,
      subject: input.subject,
      report,
      contact,
      attachments,
      lifespanMonths: input.lifespanMonths,
      passphrase: input.passphrase,
    })

    // Transport: the shares go to the nodes; the nodes hand the token to the server.
    const deposit = await this.network.intake({
      reportId,
      canonicalSubject: canonical,
      reporterAccount: reporterSession,
      shares,
      withdrawalHash,
      expiresAt,
      now: createdAt,
    })
    const eligibleBefore = new Set(this.server.cases().filter((c) => c.eligible).map((c) => c.caseId))
    const caseId = this.server.store({
      id: reportId,
      token: deposit.token,
      tokenDigest: `0x${toHex((await sha256(deposit.token)).slice(0, 10))}`,
      reporterTag: deposit.reporterTag,
      report,
      contact,
      attachments,
      withdrawalSalt,
      createdAt,
      expiresAt,
    })

    const sealedBytes =
      report.ciphertext.length +
      (contact?.ciphertext.length ?? 0) +
      attachments.reduce((sum, a) => sum + a.ciphertext.length, 0)
    const receipt: Receipt = {
      reportId,
      sealedBytes,
      attachmentCount: attachments.length,
      sealedAt: createdAt,
      expiresAt,
      lifespanMonths: input.lifespanMonths,
      status: 'sealed',
    }
    this.receipts.push(receipt)
    this.log(
      'Anonymous reporter',
      'Sealed a report',
      `${reportId}: ${formatBytes(sealedBytes)} of ciphertext. Its key went out in ${NODE_COUNT} shares, one per node.`,
    )

    const summary = this.server.cases().find((c) => c.caseId === caseId)
    if (summary?.eligible && !eligibleBefore.has(caseId)) {
      this.log(
        'Node network',
        'A case reached the threshold',
        `${caseId}: ${summary.independentReporters} independent reports match. Still sealed, waiting for ${STEWARD_QUORUM} of ${this.stewards.length} stewards.`,
      )
    }
    this.changed()
    return { ...receipt }
  }

  /**
   * Withdraws with the passphrase. Before the threshold everything is deleted; after it, only
   * the optional contact details can be removed.
   */
  async withdraw(reportId: string, passphrase: string): Promise<Receipt['status']> {
    const receipt = this.receipts.find((r) => r.reportId === reportId)
    const salt = this.server.withdrawalSalt(reportId)
    if (!receipt || !salt || receipt.status !== 'sealed') {
      throw new InputError('There is no sealed report with that id.')
    }
    if (this.remote && (await this.remote.withdraw(reportId, passphrase)) === 'refused') {
      throw new InputError('That passphrase does not match this report.')
    }
    const results = await this.network.withdraw(reportId, await passphraseProof(passphrase, salt))

    if (results.every((r) => r === 'refused')) {
      throw new InputError('That passphrase does not match this report.')
    }
    if (results.every((r) => r === 'deleted')) {
      this.server.delete(reportId)
      receipt.status = 'withdrawn'
      this.log(
        'Anonymous reporter',
        'Withdrew a report',
        `${reportId}: ciphertext, matching token and all ${NODE_COUNT} key shares deleted.`,
      )
    } else if (results.every((r) => r === 'locked')) {
      this.server.deleteContact(reportId)
      receipt.status = 'contact-removed'
      this.log(
        'Anonymous reporter',
        'Withdrawal limited',
        `${reportId} is part of a case past the threshold. Only its optional contact details were deleted.`,
        'refused',
      )
    } else {
      throw new Error('The nodes disagreed about this withdrawal; nothing was changed.')
    }
    this.changed()
    return receipt.status
  }

  // ---- time ----

  /** Moves the simulated clock forward and deletes whatever expired unmatched. */
  advanceMonths(months: number): string[] {
    this.monthsAdvanced += months
    const removed = this.network.sweep(this.now())
    for (const id of removed) {
      this.server.delete(id)
      const receipt = this.receipts.find((r) => r.reportId === id)
      if (receipt) receipt.status = 'expired'
      this.log(
        'Retention',
        'Deleted an expired report',
        `${id} reached the end of its lifespan without a second report. Ciphertext and shares are gone for good.`,
      )
    }
    this.changed()
    return removed
  }

  // ---- stewards ----

  private steward(id: StewardId): Steward {
    const steward = this.stewards.find((s) => s.id === id)
    if (!steward) throw new Error(`No steward ${id}`)
    return steward
  }

  private caseById(caseId: string): CaseSummary {
    const found = this.server.cases().find((c) => c.caseId === caseId)
    if (!found) throw new InputError(`No case ${caseId}`)
    return found
  }

  /** A steward signs the release of one case. They see its id and report ids, never content. */
  async approve(stewardId: StewardId, caseId: string): Promise<VerdictBatch> {
    const steward = this.steward(stewardId)
    const summary = this.caseById(caseId)
    if (!summary.eligible) throw new InputError('This case has not reached the threshold.')
    const signature = await sign(steward.keys.privateKey, releaseMessage(summary.caseId, summary.reportIds))
    steward.stance = 'approved'
    const approvals = this.server.addApproval(caseId, { stewardId: steward.id, signature })
    this.log(steward.seat, 'Approved opening a case', `${caseId}: signed the release of ${summary.reportIds.join(' and ')}.`)
    return this.submit('Operator server', caseId, approvals, false)
  }

  /** A steward holds back. Nothing is sent; nobody else can sign in their place. */
  hold(stewardId: StewardId): void {
    const steward = this.steward(stewardId)
    if (steward.stance === 'waiting') steward.stance = 'holding'
    this.changed()
  }

  // ---- the rogue admin ----

  dumpDatabase(): AttackResult {
    const rows = this.server.dump()
    const total = rows.reduce(
      (sum, r) => sum + r.ciphertextBytes + r.contactBytes + r.attachmentBytes.reduce((a, b) => a + b, 0),
      0,
    )
    const result = this.recordAttack({
      kind: 'dump',
      title: 'Exported the whole database',
      outcome: `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}, ${formatBytes(total)} of ciphertext, 0 readable. No key or key share is stored on the server.`,
    })
    return result
  }

  /** Hashes a directory of staff names every way the admin can think of and looks for hits. */
  async dictionaryAttack(): Promise<AttackResult> {
    const guesses: Bytes[] = []
    for (const subject of DIRECTORY_GUESSES) {
      guesses.push(await sha256(utf8(subject.name)))
      guesses.push(await sha256(utf8(normaliseName(subject.name))))
      guesses.push(await sha256(utf8(`${normaliseIdentifier(subject.identifier)}|${normaliseName(subject.name)}`)))
      try {
        // The recipe is open source, so the admin can build the exact canonical string too.
        guesses.push(await sha256(utf8(canonicalSubject(subject))))
      } catch {
        // an incomplete guess cannot produce a canonical string; skip that recipe
      }
    }
    const matches = this.server.countTokenMatches(guesses)
    return this.recordAttack({
      kind: 'dictionary',
      title: `Hashed ${DIRECTORY_GUESSES.length} staff names ${guesses.length} ways`,
      outcome: `${matches} matches. The token is keyed by the node network, so hashing names, even with the published recipe, never reproduces it.`,
    })
  }

  /**
   * Everything an admin with full server access can try at once: add their own key to the
   * server's steward table, sign with it, forge signatures for the real seats, and attach any
   * genuine approvals already on the server.
   */
  async forceDecrypt(caseId: string): Promise<AttackResult> {
    if (!this.adminKeys) {
      this.adminKeys = await generateSigningKeys()
      this.server.stewardTable.push({
        id: 'it-admin',
        seat: 'IT admin',
        fingerprint: await fingerprint(this.adminKeys.publicKey),
        addedBy: 'admin',
      })
    }
    const summary = this.caseById(caseId)
    const message = releaseMessage(summary.caseId, summary.reportIds)
    const genuine = this.server.approvals.get(caseId) ?? []
    const forged: Approval[] = this.stewards
      .filter((s) => !genuine.some((a) => a.stewardId === s.id))
      .map((s) => ({ stewardId: s.id, signature: randomBytes(64) }))
    const approvals: Approval[] = [
      ...genuine,
      { stewardId: 'it-admin', signature: await sign(this.adminKeys.privateKey, message) },
      ...forged,
    ]
    const batch = await this.submit('IT admin', caseId, approvals, true)
    const refused = batch.verdicts.filter((v) => !v.released).length
    return this.recordAttack({
      kind: 'force-decrypt',
      title: `Forced a key request for ${caseId}`,
      outcome: batch.released
        ? `Released by ${NODE_COUNT - refused} of ${NODE_COUNT} nodes: the stewards had already approved.`
        : `Refused by ${refused} of ${NODE_COUNT} nodes. ${batch.verdicts[0].reason}`,
      batch,
    })
  }

  private recordAttack(result: Omit<AttackResult, 'seq' | 'at'>): AttackResult {
    const entry: AttackResult = { ...result, seq: ++this.seq, at: this.now() }
    this.attacks.push(entry)
    this.changed()
    return entry
  }

  // ---- release ----

  private async submit(
    submittedBy: string,
    caseId: string,
    approvals: Approval[],
    hostile: boolean,
  ): Promise<VerdictBatch> {
    const summary = this.server.cases().find((c) => c.caseId === caseId)
    const reportIds = summary?.reportIds ?? []
    const verdicts = await this.network.judge({ caseId, reportIds, approvals }, this.now())
    const releasedBy = verdicts.filter((v): v is Extract<NodeVerdict, { released: true }> => v.released)
    const released = releasedBy.length >= SHARE_THRESHOLD && !this.opened.has(caseId)

    const batch: VerdictBatch = {
      seq: ++this.seq,
      at: this.now(),
      submittedBy,
      caseId,
      signers: approvals.map((a) => a.stewardId),
      verdicts: verdicts.map((v) => ({ node: v.node, released: v.released, reason: v.reason })),
      released: releasedBy.length >= SHARE_THRESHOLD,
    }
    this.batches.push(batch)

    if (released) {
      await this.openCase(caseId, reportIds, releasedBy)
      this.log(
        'Node network',
        'Released the key for a case',
        `${caseId}: ${releasedBy.length} of ${NODE_COUNT} nodes sent their shares to the investigator.`,
        'released',
      )
    } else if (!batch.released && hostile) {
      this.log(
        'Node network',
        'Refused a key request',
        `${caseId}: ${NODE_COUNT - releasedBy.length} of ${NODE_COUNT} nodes refused. ${verdicts[0].reason}`,
        'refused',
      )
    } else if (!batch.released) {
      const count = new Set(approvals.map((a) => a.stewardId)).size
      this.log(
        'Node network',
        'Holding a case',
        `${caseId}: ${count} of ${STEWARD_QUORUM} steward approvals so far. Nothing is released before the quorum.`,
      )
    }
    this.changed()
    return batch
  }

  /** The investigator's side: rebuild each report key from any three shares and decrypt. */
  private async openCase(
    caseId: string,
    reportIds: string[],
    releasedBy: Extract<NodeVerdict, { released: true }>[],
  ): Promise<void> {
    const used = releasedBy.slice(0, SHARE_THRESHOLD)
    const reports: OpenedReport[] = []
    for (const reportId of reportIds) {
      const shares: Share[] = used.map((v) => {
        const share = v.shares.get(reportId)
        if (!share) throw new Error(`Node ${v.node} released no share for ${reportId}`)
        return share
      })
      const key = combine(shares)
      const sealedReport = this.server.sealedReport(reportId)
      if (!sealedReport) continue
      const parsed: unknown = JSON.parse(fromUtf8(await open(key, sealedReport, utf8(reportId))))
      const body = parsed as ReportPlaintext
      if (!isRichDoc(body.content)) throw new Error(`Report ${reportId} has no readable content`)
      const sealedContact = this.server.sealedContact(reportId)
      const contact = sealedContact ? fromUtf8(await open(key, sealedContact, utf8(`${reportId}|contact`))) : null
      const attachments: OpenedAttachment[] = []
      for (const [i, sealedFile] of this.server.sealedAttachments(reportId).entries()) {
        const meta = body.attachments[i]
        attachments.push({
          name: meta?.name ?? `file-${i + 1}`,
          type: meta?.type ?? 'application/octet-stream',
          data: await open(key, sealedFile, utf8(`${reportId}|file|${i}`)),
        })
      }
      key.fill(0)
      reports.push({
        reportId,
        sealedAt: this.server.createdAt(reportId) ?? 0,
        incidentDate: body.incidentDate,
        content: body.content,
        attachments,
        contact,
        combinedFrom: used.map((v) => v.node),
      })
    }
    reports.sort((a, b) => a.sealedAt - b.sealedAt)
    this.opened.set(caseId, reports)
  }

  // ---- snapshot ----

  private buildSnapshot(): WorldSnapshot {
    const approvals: WorldSnapshot['approvals'] = {}
    for (const [caseId, list] of this.server.approvals) {
      approvals[caseId] = list.map((a) => a.stewardId)
    }
    return {
      version: this.version,
      now: this.now(),
      monthsAdvanced: this.monthsAdvanced,
      rows: this.server.dump(),
      cases: this.server.cases(),
      receipts: this.receipts.map((r) => ({ ...r })),
      stewards: this.stewards.map((s) => ({ id: s.id, seat: s.seat, fingerprint: s.fingerprint, stance: s.stance })),
      stewardTable: this.server.stewardTable.map((s) => ({ ...s })),
      approvals,
      batches: [...this.batches],
      opened: Object.fromEntries(this.opened),
      audit: [...this.audit],
      attacks: [...this.attacks],
      nodeShares: this.network.nodes.map((n) => ({ node: n.index, shares: n.recordCount })),
    }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export { REPORT_THRESHOLD, STEWARD_QUORUM, NODE_COUNT, SHARE_THRESHOLD }
