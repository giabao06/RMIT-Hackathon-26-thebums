/**
 * Sample content for the demo. Every person, account and event here is fictional.
 * The two subjects are typed differently on purpose: normalisation must make them match.
 */
import { textDoc, type RichDoc } from './richDoc'
import type { Subject } from './subject'

export interface ReportDraft {
  subject: Subject
  incidentDate: string
  content: RichDoc
  contact: string
}

export const SAMPLE_REPORTS: [ReportDraft, ReportDraft] = [
  {
    subject: { identifier: 'E39417', name: 'Ellis Varga', unit: 'School of Science' },
    incidentDate: '2026-03-03',
    content: textDoc([
      'After the lab on 3 March he kept me back alone and commented on my body.',
      'He said my grade depended on “being friendly”. It happened again on 17 March.',
    ]),
    contact: '',
  },
  {
    subject: { identifier: 'e-39417', name: 'Dr Varga, Ellis', unit: 'school of science' },
    incidentDate: '2026-04-09',
    content: textDoc([
      'In a consultation he closed the door, stood too close and told me not to mention it to the course coordinator.',
      'I changed tutorial groups to avoid him.',
    ]),
    contact: 'Reachable through the Student Union caseworker, reference SU-1127.',
  },
]

/**
 * A rogue admin's guess list: staff names from a public directory, including the right one
 * spelled several ways. Fictional names.
 */
export const DIRECTORY_GUESSES: Subject[] = [
  ['E39417', 'Ellis Varga', 'School of Science'],
  ['E39417', 'Varga Ellis', 'Science'],
  ['', 'Ellis Varga', ''],
  ['E20551', 'Hana Okafor', 'School of Design'],
  ['E31208', 'Minh Duc Pham', 'School of Business'],
  ['E44120', 'Priya Raman', 'School of Science'],
  ['E18877', 'Tomas Lindqvist', 'School of Engineering'],
  ['E27403', 'Lan Anh Vu', 'School of Communication'],
  ['E36690', 'Samuel Adeyemi', 'School of Business'],
  ['E41902', 'Claire Dubois', 'School of Languages'],
  ['E15536', 'Quang Huy Le', 'School of Engineering'],
  ['E29981', 'Marta Kowalska', 'School of Design'],
].map(([identifier, name, unit]) => ({ identifier, name, unit }))
