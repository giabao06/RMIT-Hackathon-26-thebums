/**
 * Who may file a report: current RMIT students and staff. Signing in proves membership only.
 * The address is checked and dropped; the session keeps the role and nothing else, so no report
 * can be tied back to a name, email or student number.
 *
 * Demo gate only. In production the reporter API checks a Tide token's realm role on the
 * server; this in-tab check is not authorization.
 */
import { useSyncExternalStore } from 'react'

export type Member = 'student' | 'staff'

const DOMAINS: Record<Member, string> = {
  student: 'student.rmit.edu.au',
  staff: 'rmit.edu.au',
}

export const EMAIL_HINT: Record<Member, string> = {
  student: 's1234567@student.rmit.edu.au',
  staff: 'firstname.lastname@rmit.edu.au',
}

/** Returns an error to show, or null when the address belongs to the chosen group. */
export function checkMemberEmail(member: Member, email: string): string | null {
  const value = email.trim().toLowerCase()
  const at = value.lastIndexOf('@')
  if (at < 1 || at === value.length - 1) return 'Enter your RMIT email address.'
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (member === 'student') {
    if (domain !== DOMAINS.student) return `Student addresses end in @${DOMAINS.student}.`
    if (!/^s\d{7}$/.test(local)) return 'Student addresses start with s and your 7-digit student number.'
    return null
  }
  if (domain === DOMAINS.student) return 'That is a student address. Choose “Student” above.'
  if (domain !== DOMAINS.staff) return `Staff addresses end in @${DOMAINS.staff}.`
  if (!/^[a-z][a-z.'-]*$/.test(local)) return 'Check the part before the @.'
  return null
}

// Kept in memory for this tab only, like the report draft: nothing to find on a shared device.
let current: Member | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function set(next: Member | null): void {
  current = next
  for (const listener of listeners) listener()
}

export function signInAs(member: Member): void {
  set(member)
}

export function signOut(): void {
  set(null)
}

export function useMember(): Member | null {
  return useSyncExternalStore(subscribe, () => current)
}
