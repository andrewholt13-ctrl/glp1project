import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPasswordResetEmail } from './email.ts'

test('builds a password reset email with a reset link', () => {
  const email = buildPasswordResetEmail({
    to: 'patient@example.com',
    resetCode: '123456',
    appName: 'Butter Health',
    resetUrl: 'https://butterhealth.com/reset?email=patient@example.com&token=abc123',
  })

  assert.equal(email.subject, 'Butter Health password reset link')
  assert.match(email.html, /butterhealth.com\/reset\?email=patient@example.com&token=abc123/)
  assert.match(email.text, /butterhealth.com\/reset\?email=patient@example.com&token=abc123/)
  assert.equal(email.to, 'patient@example.com')
})
