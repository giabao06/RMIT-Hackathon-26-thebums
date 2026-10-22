/** Shared constants and shapes for the reporter and investigator flows. */
import type { Bytes } from './bytes'
import type { RichDoc } from './richDoc'
import type { Subject } from './subject'

export const LIFESPAN_OPTIONS = [12, 15, 18] as const
export const MAX_ATTACHMENTS = 3
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MIN_PASSPHRASE_LENGTH = 8
export const REPORT_THRESHOLD = 2

export const STEWARD_SEATS = [
  { id: 'student-union', seat: 'Student Union' },
  { id: 'independent-ngo', seat: 'Independent NGO' },
  { id: 'inspectorate', seat: 'Inspectorate' },
] as const

export type StewardId = (typeof STEWARD_SEATS)[number]['id']
export type StewardStance = 'waiting' | 'approved' | 'holding'

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
}

export interface AuditEntry {
  seq: number
  at: number
  actor: string
  action: string
  detail: string
  tone: 'neutral' | 'refused' | 'released'
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
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
