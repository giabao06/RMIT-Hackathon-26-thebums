import { randomBytes } from '@/escrow/bytes'
import { textDoc, type RichDoc } from '@/escrow/richDoc'
import type { ReportDraft } from '@/escrow/samples'
import type { Subject } from '@/escrow/subject'

export interface Draft {
  subject: Subject
  incidentDate: string
  content: RichDoc
  text: string
  files: File[]
  lifespanMonths: number
  passphrase: string
  confirm: string
  contact: string
}

export function emptyDraft(): Draft {
  return {
    subject: { identifier: '', name: '', unit: '' },
    incidentDate: '',
    content: textDoc([]),
    text: '',
    files: [],
    lifespanMonths: 12,
    passphrase: '',
    confirm: '',
    contact: '',
  }
}

export function draftFromSample(sample: ReportDraft): Draft {
  return {
    ...emptyDraft(),
    subject: { ...sample.subject },
    incidentDate: sample.incidentDate,
    content: sample.content,
    text: (sample.content.content ?? []).map((p) => p.content?.[0]?.text ?? '').join('\n'),
    contact: sample.contact,
  }
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** Four groups of four from a 31-symbol alphabet without look-alikes: about 79 bits. */
export function generatePassphrase(): string {
  const bytes = randomBytes(16)
  // 248 is the largest multiple of 31 below 256; rejecting above it keeps the choice unbiased.
  const chars: string[] = []
  let pool = bytes
  let i = 0
  while (chars.length < 16) {
    if (i >= pool.length) {
      pool = randomBytes(16)
      i = 0
    }
    const b = pool[i++]
    if (b < 248) chars.push(ALPHABET[b % 31])
  }
  return chars.join('').match(/.{4}/g)!.join('-')
}
