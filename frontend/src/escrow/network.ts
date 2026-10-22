/**
 * The node network: a stand-in for Tide's ORK network.
 *
 * Each node holds one Shamir share of every report key and a steward registry that was
 * pinned when the network was set up. A node releases its shares only after checking, on
 * its own records and with its own copy of the registry, that
 *   1. the reports in the request really match each other,
 *   2. they come from enough independent reporters, and
 *   3. enough registered stewards signed this exact request.
 * Nothing the operator's server says is taken on trust.
 *
 * Simplifications, stated so nobody mistakes them for the production design:
 * - The matching key is held by this class as one value. In production the blinded token is
 *   computed by a threshold OPRF across the nodes, so no node holds the key and no node sees
 *   the subject's name.
 * - Shares are handed back as plain values. In production each node encrypts its share to
 *   the investigator's key.
 */
import { equalBytes, randomBytes, toHex, utf8, type Bytes } from './bytes'
import { hmacSha256, sha256, verify } from './crypto'
import type { Share } from './shamir'

export const NODE_COUNT = 5
export const SHARE_THRESHOLD = 3
export const REPORT_THRESHOLD = 2
export const STEWARD_QUORUM = 2

export interface Approval {
  stewardId: string
  signature: Bytes
}

export interface ReleaseRequest {
  caseId: string
  reportIds: string[]
  approvals: Approval[]
}

export type NodeVerdict =
  | { node: number; released: true; reason: string; shares: Map<string, Share> }
  | { node: number; released: false; reason: string }

export interface StewardRegistration {
  id: string
  publicKey: CryptoKey
}

interface ShareRecord {
  reportId: string
  token: Bytes
  reporterTag: Bytes
  share: Share
  withdrawalHash: Bytes
  expiresAt: number
  /**
   * Set once the record's case reaches the threshold, and never cleared. A locked record no
   * longer expires and can no longer be fully withdrawn, so a steward who stalls cannot let
   * the clock delete a case that is waiting for them.
   */
  locked: boolean
}

type NewShareRecord = Omit<ShareRecord, 'locked'>

/** The exact bytes a steward signs. Report ids are sorted so their order cannot be gamed. */
export function releaseMessage(caseId: string, reportIds: readonly string[]): Bytes {
  return utf8(`safethreshold:release:v1|${caseId}|${[...reportIds].sort().join(',')}`)
}

export class Node {
  private readonly records = new Map<string, ShareRecord>()
  private readonly registry: ReadonlyMap<string, CryptoKey>
  readonly index: number

  constructor(index: number, registry: readonly StewardRegistration[]) {
    this.index = index
    this.registry = new Map(registry.map((s) => [s.id, s.publicKey]))
  }

  get recordCount(): number {
    return this.records.size
  }

  /** Stores a new share, then locks its case if this report brings it to the threshold. */
  hold(record: NewShareRecord, now: number): void {
    this.records.set(record.reportId, { ...record, locked: false })
    const matching = this.liveRecords(now).filter((r) => equalBytes(r.token, record.token))
    const reporters = new Set(matching.map((r) => toHex(r.reporterTag))).size
    if (reporters >= REPORT_THRESHOLD) {
      for (const r of matching) r.locked = true
    }
  }

  private isLive(record: ShareRecord, now: number): boolean {
    return record.locked || record.expiresAt > now
  }

  private liveRecords(now: number): ShareRecord[] {
    return [...this.records.values()].filter((r) => this.isLive(r, now))
  }

  isEligible(reportId: string): boolean {
    return this.records.get(reportId)?.locked ?? false
  }

  /**
   * Deletes this node's share if the withdrawal proof is right and the case has not reached
   * the threshold. Returns what happened, so the caller can report it.
   */
  async withdraw(reportId: string, proof: Bytes): Promise<'deleted' | 'locked' | 'refused'> {
    const record = this.records.get(reportId)
    if (!record) return 'refused'
    if (!equalBytes(await sha256(proof), record.withdrawalHash)) return 'refused'
    if (record.locked) return 'locked'
    this.records.delete(reportId)
    return 'deleted'
  }

  /** Deletes shares of reports that expired before their case reached the threshold. */
  sweep(now: number): string[] {
    const removed: string[] = []
    for (const record of [...this.records.values()]) {
      if (!this.isLive(record, now)) {
        this.records.delete(record.reportId)
        removed.push(record.reportId)
      }
    }
    return removed
  }

  /**
   * Decides on a release request. Every check runs, and a refusal lists every reason, so an
   * attacker's request shows all the ways it failed rather than only the first.
   */
  async judge(request: ReleaseRequest, now: number): Promise<NodeVerdict> {
    const reasons: string[] = []
    const ids = [...new Set(request.reportIds)]

    const records: ShareRecord[] = []
    for (const id of ids) {
      const record = this.records.get(id)
      if (record && this.isLive(record, now)) records.push(record)
      else reasons.push(`holds no live share for ${id}`)
    }

    const sameSubject = records.every((r) => equalBytes(r.token, records[0].token))
    if (!sameSubject) reasons.push('the reports are not about the same person')

    const reporters = new Set(records.map((r) => toHex(r.reporterTag))).size
    if (sameSubject && reporters < REPORT_THRESHOLD) {
      reasons.push(`${reporters} independent ${reporters === 1 ? 'report' : 'reports'}, ${REPORT_THRESHOLD} needed`)
    }

    const message = releaseMessage(request.caseId, ids)
    const valid = new Set<string>()
    for (const approval of request.approvals) {
      const key = this.registry.get(approval.stewardId)
      if (!key) {
        reasons.push(`“${approval.stewardId}” is not a registered steward`)
      } else if (await verify(key, approval.signature, message)) {
        valid.add(approval.stewardId)
      } else {
        reasons.push(`the signature for “${approval.stewardId}” does not verify`)
      }
    }
    if (valid.size < STEWARD_QUORUM) {
      reasons.push(`${valid.size} of ${STEWARD_QUORUM} steward signatures`)
    }

    if (reasons.length > 0) {
      const text = reasons.join('; ')
      return { node: this.index, released: false, reason: text[0].toUpperCase() + text.slice(1) + '.' }
    }

    const shares = new Map<string, Share>()
    for (const record of records) shares.set(record.reportId, record.share)
    return {
      node: this.index,
      released: true,
      reason: `${valid.size} valid steward signatures, ${reporters} independent reports.`,
      shares,
    }
  }
}

export interface TokenDeposit {
  token: Bytes
  reporterTag: Bytes
}

export class NodeNetwork {
  readonly nodes: Node[]
  private readonly matchingKey = randomBytes(32)
  private readonly reporterKey = randomBytes(32)

  constructor(registry: readonly StewardRegistration[]) {
    this.nodes = Array.from({ length: NODE_COUNT }, (_, i) => new Node(i + 1, registry))
  }

  /**
   * Takes in a new report's shares and returns the matching token and reporter tag. The
   * caller passes these straight to the server; the reporter's device never sees them.
   */
  async intake(input: {
    reportId: string
    canonicalSubject: string
    reporterAccount: string
    shares: Share[]
    withdrawalHash: Bytes
    expiresAt: number
    now: number
  }): Promise<TokenDeposit> {
    if (input.shares.length !== this.nodes.length) {
      throw new Error(`Expected ${this.nodes.length} shares, got ${input.shares.length}`)
    }
    const token = await hmacSha256(this.matchingKey, utf8(input.canonicalSubject))
    // The reporter tag is per subject: the same reporter writing twice about the same person
    // counts once, while their reports about different people cannot be linked.
    const reporterTag = await hmacSha256(
      this.reporterKey,
      utf8(`${input.reporterAccount}|${toHex(token)}`),
    )
    this.nodes.forEach((node, i) =>
      node.hold(
        {
          reportId: input.reportId,
          token,
          reporterTag,
          share: input.shares[i],
          withdrawalHash: input.withdrawalHash,
          expiresAt: input.expiresAt,
        },
        input.now,
      ),
    )
    return { token, reporterTag }
  }

  async withdraw(reportId: string, proof: Bytes) {
    return Promise.all(this.nodes.map((node) => node.withdraw(reportId, proof)))
  }

  sweep(now: number): string[] {
    const removed = new Set<string>()
    for (const node of this.nodes) for (const id of node.sweep(now)) removed.add(id)
    return [...removed]
  }

  async judge(request: ReleaseRequest, now: number): Promise<NodeVerdict[]> {
    return Promise.all(this.nodes.map((node) => node.judge(request, now)))
  }
}

