import { describe, expect, it } from 'vitest'
import { fromUtf8, utf8 } from './bytes'
import { plainText } from './richDoc'
import { SAMPLE_REPORTS } from './samples'
import { EscrowWorld, InputError, type ReportInput } from './simulation'

const PASS_A = 'correct horse battery'
const PASS_B = 'tutorial group seven'

function input(i: 0 | 1, passphrase: string, extra: Partial<ReportInput> = {}): ReportInput {
  const draft = SAMPLE_REPORTS[i]
  return {
    subject: draft.subject,
    incidentDate: draft.incidentDate,
    content: draft.content,
    attachments: [],
    contact: draft.contact,
    lifespanMonths: 12,
    passphrase,
    ...extra,
  }
}

async function twoReports() {
  const world = await EscrowWorld.create()
  const a = await world.submitReport(world.newReporterSession(), input(0, PASS_A))
  const b = await world.submitReport(world.newReporterSession(), input(1, PASS_B))
  return { world, a, b, caseId: world.getSnapshot().cases[0].caseId }
}

describe('matching', () => {
  it('keeps a single report sealed and not eligible', async () => {
    const world = await EscrowWorld.create()
    await world.submitReport(world.newReporterSession(), input(0, PASS_A))
    const [only] = world.getSnapshot().cases
    expect(only.eligible).toBe(false)
    expect(only.reportIds).toHaveLength(1)
  })

  it('groups two independent reports about the same person into one eligible case', async () => {
    const { world } = await twoReports()
    const cases = world.getSnapshot().cases
    expect(cases).toHaveLength(1)
    expect(cases[0].eligible).toBe(true)
    expect(cases[0].independentReporters).toBe(2)
  })

  it('counts the same reporter twice as one', async () => {
    const world = await EscrowWorld.create()
    const session = world.newReporterSession()
    await world.submitReport(session, input(0, PASS_A))
    await world.submitReport(session, input(1, PASS_B))
    expect(world.getSnapshot().cases[0].eligible).toBe(false)
  })

  it('keeps reports about different people apart', async () => {
    const world = await EscrowWorld.create()
    await world.submitReport(world.newReporterSession(), input(0, PASS_A))
    await world.submitReport(
      world.newReporterSession(),
      input(1, PASS_B, { subject: { identifier: 'E20551', name: 'Hana Okafor', unit: 'School of Design' } }),
    )
    const cases = world.getSnapshot().cases
    expect(cases).toHaveLength(2)
    expect(cases.every((c) => !c.eligible)).toBe(true)
  })

  it('never puts the token or any plaintext in the snapshot', async () => {
    const { world } = await twoReports()
    const text = JSON.stringify(world.getSnapshot())
    expect(text).not.toContain('Varga')
    expect(text).not.toContain('consultation')
    expect(text).not.toContain('SU-1127')
  })
})

describe('release', () => {
  it('opens nothing with one steward approval', async () => {
    const { world, caseId } = await twoReports()
    const batch = await world.approve('student-union', caseId)
    expect(batch.released).toBe(false)
    expect(world.getSnapshot().opened[caseId]).toBeUndefined()
  })

  it('opens both reports with two of three approvals', async () => {
    const { world, caseId } = await twoReports()
    await world.approve('student-union', caseId)
    const batch = await world.approve('inspectorate', caseId)
    expect(batch.released).toBe(true)
    const opened = world.getSnapshot().opened[caseId]
    expect(opened).toHaveLength(2)
    expect(plainText(opened[0].content)).toContain('After the lab')
    expect(opened[1].contact).toContain('SU-1127')
  })

  it('refuses to let a steward approve a case below the threshold', async () => {
    const world = await EscrowWorld.create()
    await world.submitReport(world.newReporterSession(), input(0, PASS_A))
    const caseId = world.getSnapshot().cases[0].caseId
    await expect(world.approve('student-union', caseId)).rejects.toThrow(InputError)
  })

  it('decrypts attachments for the investigator', async () => {
    const world = await EscrowWorld.create()
    const file = { name: 'messages.txt', type: 'text/plain', data: utf8('see you after class') }
    await world.submitReport(world.newReporterSession(), input(0, PASS_A, { attachments: [file] }))
    await world.submitReport(world.newReporterSession(), input(1, PASS_B))
    const caseId = world.getSnapshot().cases[0].caseId
    await world.approve('student-union', caseId)
    await world.approve('independent-ngo', caseId)
    const [first] = world.getSnapshot().opened[caseId]
    expect(first.attachments[0].name).toBe('messages.txt')
    expect(fromUtf8(first.attachments[0].data)).toBe('see you after class')
  })
})

describe('the rogue admin', () => {
  it('finds nothing by hashing staff names', async () => {
    const { world } = await twoReports()
    const result = await world.dictionaryAttack()
    expect(result.outcome.startsWith('0 matches')).toBe(true)
  })

  it('cannot force a release with forged signatures and its own key', async () => {
    const { world, caseId } = await twoReports()
    const result = await world.forceDecrypt(caseId)
    expect(result.batch?.released).toBe(false)
    expect(result.batch?.verdicts.every((v) => !v.released)).toBe(true)
    expect(result.batch?.verdicts[0].reason).toContain('not a registered steward')
    expect(result.batch?.verdicts[0].reason).toContain('does not verify')
    expect(world.getSnapshot().opened[caseId]).toBeUndefined()
  })

  it('cannot turn one genuine approval into a release', async () => {
    const { world, caseId } = await twoReports()
    await world.approve('student-union', caseId)
    const result = await world.forceDecrypt(caseId)
    expect(result.batch?.released).toBe(false)
    expect(result.batch?.verdicts[0].reason).toContain('1 of 2 steward signatures')
  })
})

describe('withdrawal', () => {
  it('deletes everything before the threshold, and the case is no longer eligible', async () => {
    const world = await EscrowWorld.create()
    const a = await world.submitReport(world.newReporterSession(), input(0, PASS_A))
    expect(await world.withdraw(a.reportId, PASS_A)).toBe('withdrawn')
    await world.submitReport(world.newReporterSession(), input(1, PASS_B))
    const snapshot = world.getSnapshot()
    expect(snapshot.rows).toHaveLength(1)
    expect(snapshot.cases[0].eligible).toBe(false)
    expect(snapshot.nodeShares.every((n) => n.shares === 1)).toBe(true)
  })

  it('refuses a wrong passphrase and changes nothing', async () => {
    const world = await EscrowWorld.create()
    const a = await world.submitReport(world.newReporterSession(), input(0, PASS_A))
    await expect(world.withdraw(a.reportId, 'wrong passphrase')).rejects.toThrow('does not match')
    expect(world.getSnapshot().rows).toHaveLength(1)
  })

  it('after the threshold removes only the contact details', async () => {
    const { world, b, caseId } = await twoReports()
    expect(await world.withdraw(b.reportId, PASS_B)).toBe('contact-removed')
    const snapshot = world.getSnapshot()
    expect(snapshot.rows).toHaveLength(2)
    expect(snapshot.rows.find((r) => r.id === b.reportId)?.contactBytes).toBe(0)
    expect(snapshot.cases.find((c) => c.caseId === caseId)?.eligible).toBe(true)
  })
})

describe('expiry', () => {
  it('deletes an unmatched report at the end of its lifespan, not before', async () => {
    const world = await EscrowWorld.create()
    const a = await world.submitReport(world.newReporterSession(), input(0, PASS_A, { lifespanMonths: 15 }))
    expect(world.advanceMonths(12)).toEqual([])
    expect(world.advanceMonths(3)).toEqual([a.reportId])
    const snapshot = world.getSnapshot()
    expect(snapshot.rows).toHaveLength(0)
    expect(snapshot.nodeShares.every((n) => n.shares === 0)).toBe(true)
    expect(snapshot.receipts[0].status).toBe('expired')
  })

  it('keeps an eligible case past the lifespan, so a stalling steward cannot run out the clock', async () => {
    const { world, caseId } = await twoReports()
    expect(world.advanceMonths(24)).toEqual([])
    await world.approve('student-union', caseId)
    const batch = await world.approve('independent-ngo', caseId)
    expect(batch.released).toBe(true)
  })

  it('does not match a new report against one that already expired', async () => {
    const world = await EscrowWorld.create()
    await world.submitReport(world.newReporterSession(), input(0, PASS_A))
    world.advanceMonths(13)
    await world.submitReport(world.newReporterSession(), input(1, PASS_B))
    expect(world.getSnapshot().cases[0].eligible).toBe(false)
  })

  it('rejects a lifespan outside 12 to 18 months', async () => {
    const world = await EscrowWorld.create()
    await expect(
      world.submitReport(world.newReporterSession(), input(0, PASS_A, { lifespanMonths: 6 })),
    ).rejects.toThrow(InputError)
  })
})
