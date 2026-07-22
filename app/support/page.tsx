'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TicketType = 'Doctor' | 'Pharmacy' | 'Website'

const ticketTypes: { value: TicketType; label: string }[] = [
  { value: 'Doctor', label: 'Doctor' },
  { value: 'Pharmacy', label: 'Pharmacy' },
  { value: 'Website', label: 'Website' },
]

export default function SupportPage() {
  const router = useRouter()
  const [type, setType] = useState<TicketType>('Doctor')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [orderReference, setOrderReference] = useState('')
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function isOrderNumberReference(value: string) {
    return /^[A-Z0-9]{5}$/i.test(value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        name,
        email,
        subject,
        message,
        ...(orderReference.trim()
          ? isOrderNumberReference(orderReference.trim())
            ? { orderNumber: orderReference.trim() }
            : { orderId: orderReference.trim() }
          : {}),
      }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(`/support/thank-you?ticket=${data.ticketNumber}`)
    } else {
      setStatus(data.error || 'Unable to submit ticket. Please try again.')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="mb-8 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Customer Support</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">Submit a support request</h1>
              <p className="mt-2 text-sm text-slate-600">Choose the right team and describe your issue to receive a response in the portal.</p>
            </div>
            <div className="rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700">Ticket tracking for website support</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Support category</label>
                <div className="grid grid-cols-3 gap-3">
                  {ticketTypes.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setType(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${type === option.value ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-gray-200 bg-white text-slate-700 hover:border-slate-300'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Name</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>

              <div>
                <label className="label">Subject</label>
                <input className="input" value={subject} onChange={e => setSubject(e.target.value)} required />
              </div>

              <div>
                <label className="label">Order reference (optional)</label>
                <input
                  className="input"
                  value={orderReference}
                  onChange={e => setOrderReference(e.target.value)}
                  placeholder="A1B2C or order id"
                />
              </div>

              <div>
                <label className="label">Message</label>
                <textarea className="input" rows={6} value={message} onChange={e => setMessage(e.target.value)} required />
              </div>

              {status && <p className="text-sm text-red-600">{status}</p>}

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Submitting…' : 'Submit support ticket'}
              </button>
            </form>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-cyan-500 p-8 text-white shadow-sm ring-1 ring-brand-200">
            <h2 className="text-xl font-semibold">Need help choosing?</h2>
            <p className="mt-4 text-sm leading-6 text-white/85">Doctor support is for clinical questions, pharmacy support is for medication and shipping, and website support is for account or portal issues.</p>
            <div className="mt-6 space-y-4 text-sm">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold">Doctor support</p>
                <p className="mt-1 text-white/80">Questions about your prescription, clinical guidance, or treatment suitability.</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold">Pharmacy support</p>
                <p className="mt-1 text-white/80">Shipping, order status, doses, and pharmacy fulfillment.</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="font-semibold">Website support</p>
                <p className="mt-1 text-white/80">Login, account, portal access, and site functionality.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
