'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
]

export default function LandingPage() {
  const router = useRouter()
  const params = useSearchParams()
  const ref = params.get('ref') ?? ''

  const [selectedState, setSelectedState] = useState('')
  const [outOfStateUrl, setOutOfStateUrl] = useState('https://example.com/other-states')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.outOfStateUrl) setOutOfStateUrl(d.outOfStateUrl)
    })
  }, [])

  function handleContinue() {
    if (!selectedState) return
    setLoading(true)
    if (selectedState === 'Georgia') {
      const q = new URLSearchParams({ state: 'Georgia', ...(ref ? { ref } : {}) })
      router.push(`/intake?${q}`)
    } else {
      window.location.href = outOfStateUrl
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-stone-50 to-white">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-start">
          <span className="text-lg font-bold text-brand-700">💊 GLP-1 Wellness</span>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 max-w-xl rounded-3xl border border-brand-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-stone-600">
              Have an account? Sign in here to manage your intake, orders, and provider visits.
            </p>
            <div className="mt-4 flex justify-center">
              <a
                href="/login"
                className="btn-secondary inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold"
              >
                Sign in here
              </a>
            </div>
          </div>

          <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full mb-4">
            Medical Weight Loss Program
          </span>
          <h1 className="text-4xl font-extrabold leading-tight text-stone-900 md:text-5xl">
            Lose Weight with <span className="text-brand-600">GLP-1 Therapy</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-stone-600">
            Semaglutide &amp; Tirzepatide programs with licensed providers, compounding pharmacy, and ongoing support — all in one place.
          </p>
        </div>

        {/* State Selector Card */}
        <div className="max-w-md mx-auto">
          <div className="card text-center">
            <h2 className="mb-2 text-xl font-bold text-stone-900">Get Started</h2>
            <p className="mb-6 text-sm text-stone-500">Select your state to check availability.</p>

            <div className="mb-4">
              <label className="label text-left">Which state do you live in?</label>
              <select
                className="input"
                value={selectedState}
                onChange={e => setSelectedState(e.target.value)}
              >
                <option value="">Select a state…</option>
                {US_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleContinue}
              disabled={!selectedState || loading}
              className="btn-primary w-full"
            >
              {loading ? 'Redirecting…' : 'Check Availability'}
            </button>

            {selectedState && selectedState !== 'Georgia' && (
              <p className="mt-3 text-xs text-stone-500">
                We&apos;ll connect you with a partner program that serves {selectedState}.
              </p>
            )}
            {selectedState === 'Georgia' && (
              <p className="mt-3 text-xs text-brand-600 font-medium">
                ✓ Great news — we serve Georgia patients directly!
              </p>
            )}
          </div>

          {/* How it works */}
          <div className="mt-10 grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
            {[
              { icon: '📋', step: '1', label: 'Complete intake form' },
              { icon: '👩‍⚕️', step: '2', label: 'Provider review & script' },
              { icon: '📦', step: '3', label: 'Medication delivered' },
            ].map(item => (
              <div key={item.step} className="card px-3 py-4">
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="text-xs font-bold text-brand-600 uppercase">Step {item.step}</div>
                <div className="mt-1 text-xs text-stone-600">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
