import { describe, expect, it } from 'vitest'
import { checkMemberEmail } from './membership'

describe('checkMemberEmail', () => {
  it('accepts a student address with a 7-digit number', () => {
    expect(checkMemberEmail('student', ' S3912345@Student.RMIT.edu.au ')).toBeNull()
  })

  it('rejects a student address without the number pattern', () => {
    expect(checkMemberEmail('student', 'alex@student.rmit.edu.au')).toMatch(/7-digit/)
  })

  it('rejects other domains for students', () => {
    expect(checkMemberEmail('student', 's3912345@gmail.com')).toMatch(/student\.rmit\.edu\.au/)
  })

  it('accepts a staff address', () => {
    expect(checkMemberEmail('staff', 'jo.nguyen@rmit.edu.au')).toBeNull()
  })

  it('sends a student address back to the student choice', () => {
    expect(checkMemberEmail('staff', 's3912345@student.rmit.edu.au')).toMatch(/student address/)
  })

  it('rejects look-alike domains', () => {
    expect(checkMemberEmail('staff', 'jo@rmit.edu.au.evil.com')).not.toBeNull()
    expect(checkMemberEmail('staff', 'jo@notrmit.edu.au')).not.toBeNull()
  })

  it('asks for an address when there is none', () => {
    expect(checkMemberEmail('staff', '')).toMatch(/Enter/)
  })
})
