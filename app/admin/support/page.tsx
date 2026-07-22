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

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selected, setSelected] = useState<SupportTicket | null>(null)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const [movingTicketId, setMovingTicketId] = useState<string | null>(null)

  function normalizeQueueStatus(status: string) {
    const upper = status.toUpperCase()
    if (upper === 'OPEN') return 'ACTIVE'
    if (upper === 'RESOLVED') return 'COMPLETED'
    if (upper === 'ACTIVE' || upper === 'PENDING' || upper === 'COMPLETED') return upper
    return 'PENDING'
  }

  function statusPillClass(status: string) {
    const normalized = normalizeQueueStatus(status)
    if (normalized === 'ACTIVE') return 'bg-blue-100 text-blue-800'
    if (normalized === 'PENDING') return 'bg-amber-100 text-amber-800'
    return 'bg-green-100 text-green-800'
  }

  const load = async () => {
    try {
      const res = await fetch('/api/support/tickets')
      const text = await res.text()
      let data: unknown = []
      try {
        data = text ? JSON.parse(text) : []
      } catch {
        data = []
      }

      if (!res.ok) {
        console.error('Failed to load support tickets', data)
        setTickets([])
        return
      }

      setTickets(Array.isArray(data) ? (data as SupportTicket[]) : [])
    } catch (err) {
      console.error('Failed to load support tickets', err)
      setTickets([])
    }
  }
  useEffect(() => { load() }, [])

  async function markResolved(id: string) {
    const res = await fetch(`/api/support/tickets/${id}/resolve`, { method: 'POST' })
    if (!res.ok) {
      const text = await res.text()
      alert(text || 'Could not mark ticket as resolved.')
      return
    }
    load()
    if (selected?.id === id) setSelected({ ...selected, status: 'COMPLETED' })
  }

  async function moveTicket(id: string, nextStatus: 'ACTIVE' | 'PENDING' | 'COMPLETED') {
    setMovingTicketId(id)
    const res = await fetch(`/api/support/tickets/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (!res.ok) {
      const text = await res.text()
      alert(text || 'Could not move ticket.')
      setMovingTicketId(null)
      return
    }

    setTickets((current) => current.map((ticket) => (ticket.id === id ? { ...ticket, status: nextStatus } : ticket)))
    if (selected?.id === id) setSelected({ ...selected, status: nextStatus })
    setMovingTicketId(null)
  }

  async function sendReply(id: string) {
    if (!reply.trim()) return
    setSaving(true)
    const res = await fetch(`/api/support/tickets/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: reply, authorRole: 'ADMIN' }),
    })
    if (!res.ok) {
      const text = await res.text()
      alert(text || 'Could not post reply.')
      setSaving(false)
      return
    }
    setReply('')
    setSaving(false)
    load()
  }

  const activeTickets = tickets.filter((ticket) => normalizeQueueStatus(ticket.status) === 'ACTIVE')
  const pendingTickets = tickets.filter((ticket) => normalizeQueueStatus(ticket.status) === 'PENDING')
  const completedTickets = tickets.filter((ticket) => normalizeQueueStatus(ticket.status) === 'COMPLETED')

  function renderQueueColumn(title: string, queueTickets: SupportTicket[]) {
    return (
      <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
          <span className="text-xs text-slate-500">{queueTickets.length}</span>
        </div>

        {queueTickets.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-500">No tickets in this queue.</div>}

        {queueTickets.map((ticket) => {
          const normalizedStatus = normalizeQueueStatus(ticket.status)
          return (
            <div
              key={ticket.id}
              onClick={() => setSelected(ticket)}
              className={`cursor-pointer rounded-2xl border p-3 transition ${selected?.id === ticket.id ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">{ticket.subject}</div>
                <span className={`rounded-full px-2 py-1 text-xs ${statusPillClass(ticket.status)}`}>{normalizedStatus}</span>
              </div>

              <div className="mt-1 text-xs text-slate-500">{ticket.ticketNumber} · {ticket.type}</div>
              <div className="mt-2 text-xs text-slate-500">{ticket.name} · {ticket.email}</div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="btn-secondary py-1 text-xs"
                  disabled={movingTicketId === ticket.id || normalizedStatus === 'ACTIVE'}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveTicket(ticket.id, 'ACTIVE')
                  }}
                >
                  Active
                </button>
                <button
                  type="button"
                  className="btn-secondary py-1 text-xs"
                  disabled={movingTicketId === ticket.id || normalizedStatus === 'PENDING'}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveTicket(ticket.id, 'PENDING')
                  }}
                >
                  Pending
                </button>
                <button
                  type="button"
                  className="btn-secondary py-1 text-xs"
                  disabled={movingTicketId === ticket.id || normalizedStatus === 'COMPLETED'}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveTicket(ticket.id, 'COMPLETED')
                  }}
                >
                  Completed
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Support Tickets</h1>
          <p className="text-sm text-slate-500">View and respond to customer support requests.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {renderQueueColumn('Active', activeTickets)}
        {renderQueueColumn('Pending', pendingTickets)}
        {renderQueueColumn('Completed', completedTickets)}
      </div>

      <div className="mt-6">
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
  )
}
