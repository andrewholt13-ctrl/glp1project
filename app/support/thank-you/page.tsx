'use client'

import { useSearchParams } from 'next/navigation'

export default function SupportThankYou() {
  const params = useSearchParams()
  const ticket = params.get('ticket')

  return (
    <div className="min-h-screen bg-slate-50 py-20">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200 text-center">
        <div className="text-brand-600 text-4xl">✅</div>
        <h1 className="mt-6 text-3xl font-semibold text-slate-900">Support request submitted</h1>
        <p className="mt-4 text-sm text-slate-600">Your ticket number is <span className="font-semibold text-slate-900">{ticket}</span>. We will get back to you shortly.</p>
        <div className="mt-8">
          <a href="/" className="btn-secondary inline-flex rounded-full px-6 py-3">Return to home</a>
        </div>
      </div>
    </div>
  )
}
