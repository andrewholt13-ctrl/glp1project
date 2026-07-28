import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPasswordResetSmsBody } from './notifications.ts'

test('builds a password reset SMS message with the reset code', () => {
  const body = buildPasswordResetSmsBody({
    resetCode: '123456',
    appName: 'Butter Health',
    firstName: 'Alex',
  })

  assert.match(body, /Butter Health/)
  assert.match(body, /123456/)
  assert.match(body, /Alex/)
})
