'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<'email' | 'sms'>('email')

  async function submit() {
    if (!email.trim()) {
      setMessage('Please enter your email.')
      return
    }

    setLoading(true)
    setMessage('')
    setResetCode('')

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, deliveryMethod }),
    })

    const text = await res.text()
    let data: { error?: string; message?: string; resetCode?: string } | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }

    if (!res.ok) {
      setMessage(data?.error ?? text ?? 'Could not start password reset.')
      setLoading(false)
      return
    }

    setMessage(data?.message ?? 'If your account exists, a reset code is ready. Continue to reset password.')
    if (data?.resetCode) setResetCode(data.resetCode)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">Forgot Password</h1>
        <p className="text-sm text-gray-500">Enter your login email to request a password reset code.</p>

        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="label">Delivery method</label>
          <div className="flex gap-2">
            <button type="button" className={`btn-secondary flex-1 ${deliveryMethod === 'email' ? 'ring-2 ring-slate-400' : ''}`} onClick={() => setDeliveryMethod('email')}>
              Email
            </button>
            <button type="button" className={`btn-secondary flex-1 ${deliveryMethod === 'sms' ? 'ring-2 ring-slate-400' : ''}`} onClick={() => setDeliveryMethod('sms')}>
              Text message
            </button>
          </div>
        </div>

        {message && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{message}</div>}
        {resetCode && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            Reset code: <span className="font-mono font-semibold">{resetCode}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={loading} onClick={submit}>
            {loading ? 'Submitting…' : 'Request Reset Code'}
          </button>
          <button className="btn-secondary" onClick={() => router.push('/login')}>Back</button>
        </div>

        <button
          className="btn-secondary w-full"
          onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
        >
          I Have A Code → Reset Password
        </button>
      </div>
    </div>
  )
}
