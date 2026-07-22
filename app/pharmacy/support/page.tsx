'use client'

import { useEffect, useState } from 'react'

type SupportTicket = {
  id: string
  ticketNumber: string
  type: string
  subject: string
  status: string
  name: string
  email: string
  createdAt: string
  updatedAt: string
  messages: { id: string; authorRole: string; body: string; createdAt: string }[]
}

export default function PharmacySupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => fetch('/api/support/tickets').then(r => r.json()).then(setTickets)
  useEffect(() => { load() }, [])

  async function markResolved(id: string) {
    await fetch(`/api/support/tickets/${id}/resolve`, { method: 'POST' })
    load()
    if (selected?.id === id) setSelected({ ...selected, status: 'RESOLVED' })
  }

  async function sendReply(id: string) {
    if (!reply.trim()) return
    setSaving(true)
    await fetch(`/api/support/tickets/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: reply, authorRole: 'PHARMACY' }),
    })
    setReply('')
    setSaving(false)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Pharmacy Support</h1>
          <p className="text-sm text-slate-500">Handle pharmacy and shipping support tickets.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {tickets.map(ticket => (
            <button
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              className={`w-full rounded-3xl border p-4 text-left transition ${selected?.id === ticket.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{ticket.subject}</div>
                  <div className="text-xs text-slate-500">{ticket.ticketNumber} · {ticket.type}</div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${ticket.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                  {ticket.status}
                </span>
              </div>
              <div className="mt-3 text-xs text-slate-500">{ticket.name} · {ticket.email}</div>
            </button>
          ))}
          {tickets.length === 0 && <div className="rounded-3xl bg-white p-6 text-sm text-slate-500">No support tickets yet.</div>}
        </div>

        <div>
          {selected ? (
            <div className="space-y-6 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">{selected.type} support</div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{selected.subject}</h2>
                  <p className="mt-2 text-sm text-slate-500">{selected.name} • {selected.email}</p>
                </div>
                <button onClick={() => markResolved(selected.id)} className="btn-secondary text-sm">
                  Mark resolved
                </button>
              </div>

              <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                {selected.messages.map(message => (
                  <div key={message.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div>{message.authorRole}</div>
                      <div>{new Date(message.createdAt).toLocaleString()}</div>
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{message.body}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <label className="label">Reply to ticket</label>
                <textarea value={reply} onChange={e => setReply(e.target.value)} rows={4} className="input" />
                <button onClick={() => sendReply(selected.id)} disabled={saving} className="btn-primary">
                  {saving ? 'Sending…' : 'Post reply'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-white p-12 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
              Select a ticket to view its details and respond.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
