import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPasswordResetEmail } from './email.ts'

test('builds a password reset email with the reset code', () => {
  const email = buildPasswordResetEmail({
    to: 'patient@example.com',
    resetCode: '123456',
    appName: 'Butter Health',
  })

  assert.equal(email.subject, 'Butter Health password reset code')
  assert.match(email.html, /123456/)
  assert.match(email.text, /123456/)
  assert.equal(email.to, 'patient@example.com')
})
