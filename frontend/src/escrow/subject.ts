/**
 * Normalising the person a report is about.
 *
 * Two people describing the same lecturer will not type the same string: "Dr Varga, Ellis"
 * and "Ellis Varga", "E-39417" and "e39417", with and without Vietnamese diacritics. The
 * matching token is computed from this normalised form, so these must collapse to one value,
 * while different people must stay different.
 */

export interface Subject {
  /** Staff or student number, as printed on a timetable or ID card. */
  identifier: string
  name: string
  /** School, department or faculty. */
  unit: string
}

export class SubjectError extends Error {}

// Titles people put in front of a name, in English and Vietnamese, removed before matching.
// Only words that are never given names: "Tiến sĩ" is left out because Tiến is a common name.
const TITLES = new Set([
  'dr', 'doctor', 'prof', 'professor', 'assoc', 'associate', 'mr', 'mrs', 'ms', 'miss', 'mx',
  'sir', 'madam', 'lecturer', 'tutor',
  'thay', 'ts', 'ths', 'pgs', 'gs',
])

function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, 'd') // đ does not decompose under NFD
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function normaliseIdentifier(identifier: string): string {
  return fold(identifier).replace(/\s+/g, '').toUpperCase()
}

/** Lower-case, no accents, no titles, words sorted so that name order does not matter. */
export function normaliseName(name: string): string {
  return fold(name)
    .split(' ')
    .filter((word) => word.length > 0 && !TITLES.has(word))
    .sort()
    .join(' ')
}

export function normaliseUnit(unit: string): string {
  return fold(unit).replace(/\s+/g, ' ')
}

/**
 * The canonical string the matching token is derived from. Versioned, so the recipe can
 * change later without old and new tokens colliding.
 */
export function canonicalSubject(subject: Subject): string {
  const identifier = normaliseIdentifier(subject.identifier)
  const name = normaliseName(subject.name)
  const unit = normaliseUnit(subject.unit)
  if (!identifier) throw new SubjectError('Add the staff or student number.')
  if (!name) throw new SubjectError('Add the person’s name.')
  if (!unit) throw new SubjectError('Add the school or department.')
  return `subject:v1|${identifier}|${name}|${unit}`
}
