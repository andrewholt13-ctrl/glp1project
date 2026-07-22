'use client'

import { useEffect, useState } from 'react'

type AuditLog = {
  id: string
  action: string
  entityType: string
  entityId: string
  actorRole: string
  reason: string | null
  beforeValue: string | null
  afterValue: string | null
  metadata: string | null
  createdAt: string
  actor: { name: string; email: string; role: string } | null
  order: { id: string; status: string; amountPaid: number | null; trackingNumber: string | null } | null
}

function prettyJson(value: string | null) {
  if (!value) return '—'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [actorRole, setActorRole] = useState('')
  const [orderId, setOrderId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  function buildQuery(format: 'json' | 'csv' = 'json') {
    const q = new URLSearchParams()
    q.set('take', '250')
    if (action) q.set('action', action)
    if (actorRole) q.set('actorRole', actorRole)
    if (orderId.trim()) q.set('orderId', orderId.trim())
    if (fromDate) q.set('from', `${fromDate}T00:00:00.000Z`)
    if (toDate) q.set('to', `${toDate}T23:59:59.999Z`)
    q.set('format', format)
    return q.toString()
  }

  function loadLogs() {
    setLoading(true)
    fetch(`/api/admin/audit?${buildQuery('json')}`)
      .then(r => r.json())
      .then((data) => {
        setLogs(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadLogs()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Audit Log</h1>
      <p className="text-sm text-gray-500 mb-6">Immutable trace of status updates, overrides, medication selection changes, and payment transition events.</p>

      <div className="card mb-4">
        <div className="grid grid-cols-5 gap-3">
          <input className="input" placeholder="Action" value={action} onChange={(e) => setAction(e.target.value)} />
          <select className="input" value={actorRole} onChange={(e) => setActorRole(e.target.value)}>
            <option value="">Any Role</option>
            <option value="MASTER_ADMIN">MASTER_ADMIN</option>
            <option value="ADMIN">ADMIN</option>
            <option value="PROVIDER">PROVIDER</option>
            <option value="PHARMACY">PHARMACY</option>
            <option value="SYSTEM">SYSTEM</option>
          </select>
          <input className="input" placeholder="Order ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-3">
          <button className="btn-secondary" onClick={loadLogs}>Apply Filters</button>
          <a className="btn-primary" href={`/api/admin/audit?${buildQuery('csv')}`}>Download CSV</a>
        </div>
      </div>

      {loading ? (
        <div className="card text-gray-500">Loading audit log…</div>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="font-semibold text-gray-900">{log.action}</div>
                <div className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div><span className="text-gray-400">Actor</span><div>{log.actor?.name ?? 'System'} ({log.actorRole})</div></div>
                <div><span className="text-gray-400">Entity</span><div>{log.entityType} · {log.entityId}</div></div>
                <div><span className="text-gray-400">Actor Email</span><div>{log.actor?.email ?? '—'}</div></div>
                <div><span className="text-gray-400">Order</span><div>{log.order?.id ?? '—'}</div></div>
              </div>

              {log.reason && (
                <div className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                  <strong>Reason:</strong> {log.reason}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-500 mb-1">Before</div>
                  <pre className="bg-gray-50 rounded p-2 overflow-auto whitespace-pre-wrap">{prettyJson(log.beforeValue)}</pre>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">After</div>
                  <pre className="bg-gray-50 rounded p-2 overflow-auto whitespace-pre-wrap">{prettyJson(log.afterValue)}</pre>
                </div>
              </div>
            </div>
          ))}

          {logs.length === 0 && <div className="card text-gray-500">No audit events yet.</div>}
        </div>
      )}
    </div>
  )
}
