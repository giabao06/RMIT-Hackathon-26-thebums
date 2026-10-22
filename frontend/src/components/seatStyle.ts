import type { StewardId } from '@/escrow/types'

/** Initials and a pale identity tint per steward seat, 60+ degrees of hue apart. */
export const SEAT_STYLE: Record<StewardId, { initials: string; tint: string }> = {
  'student-union': { initials: 'SU', tint: 'bg-seat-1' },
  'independent-ngo': { initials: 'NGO', tint: 'bg-seat-2' },
  inspectorate: { initials: 'IN', tint: 'bg-seat-3' },
}
