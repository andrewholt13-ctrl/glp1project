'use client'

import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (res?.error) {
      if (res.error.includes('PasswordResetRequired')) {
        setError('Password reset required. Please use Forgot password to set a new password.')
      } else {
        setError('Invalid email or password.')
      }
      setLoading(false)
      return
    }

    // Fetch session to determine role redirect
    const sessionRes = await fetch('/api/me')
    const session = await sessionRes.json()

    if (session.role === 'PATIENT') {
      try {
        const ordersRes = await fetch('/api/patients/orders')
        const ordersText = await ordersRes.text()
        const orders = ordersText ? JSON.parse(ordersText) : []
        const hasOrders = Array.isArray(orders) && orders.length > 0
        router.push(hasOrders ? '/status' : '/medication-selection')
        return
      } catch {
        router.push('/medication-selection')
        return
      }
    }

    const dashMap: Record<string, string> = {
      MASTER_ADMIN: '/admin',
      ADMIN: '/admin',
      PROVIDER: '/provider',
      PHARMACY: '/pharmacy',
      INFLUENCER: '/influencer',
    }
    router.push(dashMap[session.role] ?? '/')
  }

  return (
    <div className="min-h-screen bg-stone-50 py-10">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] items-center">
          <div className="rounded-3xl bg-white p-8 shadow-[0_24px_80px_rgba(74,59,42,0.08)] ring-1 ring-brand-100 sm:p-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-sm">
                <span className="text-xl">💊</span>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-600">GLP-1 Wellness</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">Sign in to your account</h1>
              </div>
            </div>

            <p className="mb-8 max-w-xl text-sm leading-6 text-stone-600">
              Secure access to your patient dashboard, appointment information, order status, and treatment progress.
            </p>

            <div className="card">
              {params.get('error') === 'Unauthorized' && (
                <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                  You don&apos;t have access to that page.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="text-right">
                  <a
                    href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Forgot password?
                  </a>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>
            </div>

            <div className="mt-6 flex items-center justify-between text-sm text-stone-500">
              <p>New patient?</p>
              <a href="/" className="font-medium text-brand-600 hover:text-brand-700">
                Start your program
              </a>
            </div>
          </div>

          <div className="hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-8 text-white shadow-[0_24px_80px_rgba(74,59,42,0.12)] lg:block">
            <div className="space-y-6">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] opacity-90">Welcome back</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Your care, simplified.</h2>
              </div>
              <p className="text-sm leading-7 text-white/90">
                Access your personalized treatment plan, consult with providers, and manage your order in one secure portal.
              </p>
              <div className="grid gap-4 pt-4">
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-sm font-semibold">Fast access</p>
                  <p className="text-xs text-white/80 mt-1">Sign in quickly and continue your intake journey without delay.</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4">
                  <p className="text-sm font-semibold">Secure data</p>
                  <p className="text-xs text-white/80 mt-1">Your health information is protected and only accessible to authorized providers.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
