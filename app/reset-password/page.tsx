'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ResetPasswordPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [code, setCode] = useState(params.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function submit() {
    if (!email.trim() || !code.trim() || !password) {
      setMessage('Email, reset code, and new password are required.')
      return
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setLoading(true)
    setMessage('')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword: password }),
    })

    const text = await res.text()
    let data: { error?: string } | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }

    if (!res.ok) {
      setMessage(data?.error ?? text ?? 'Could not reset password.')
      setLoading(false)
      return
    }

    setLoading(false)
    setMessage('Password updated. Please log in with your new password.')
    setTimeout(() => {
      router.push(`/login?email=${encodeURIComponent(email)}`)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="card w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-sm text-gray-500">Enter your email, the reset link token, and your new password.</p>

        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="label">Reset Token</label>
          <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Link token" />
        </div>

        <div>
          <label className="label">New Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div>
          <label className="label">Confirm New Password</label>
          <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>

        {message && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{message}</div>}

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={loading} onClick={submit}>
            {loading ? 'Saving…' : 'Reset Password'}
          </button>
          <button className="btn-secondary" onClick={() => router.push('/login')}>Back</button>
        </div>
      </div>
    </div>
  )
}
