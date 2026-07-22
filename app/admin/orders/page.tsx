'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getOrderRef } from '@/lib/orderRef'

type Order = {
  id: string; orderNumber: string | null; status: string; createdAt: string; amountPaid: number | null
  paymentState: 'UNPAID' | 'PAID' | 'REFUNDED' | 'VOIDED'
  patient: { user: { name: string; email: string; phone: string } }
  medication: { name: string; price: number } | null
  provider: { user: { name: string } } | null
  influencer: { user: { name: string }; code: string } | null
}

type MedicationOption = { id: string; name: string; price: number }
type PatientLookup = { id: string; userId: string; name: string; email: string; phone: string | null }

const STATUS_OPTIONS = ['INTAKE_PENDING','PROVIDER_REVIEW','REFILL_REQUESTED','PRESCRIBED','PHARMACY_PENDING','SHIPPED','COMPLETED','CANCELLED']
const BADGE: Record<string, string> = {
  INTAKE_PENDING:'badge-yellow',PROVIDER_REVIEW:'badge-blue',PRESCRIBED:'badge-blue',
  REFILL_REQUESTED:'badge-blue',
  PHARMACY_PENDING:'badge-yellow',SHIPPED:'badge-green',COMPLETED:'badge-green',CANCELLED:'badge-red',
}

export default function AdminOrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [medications, setMedications] = useState<MedicationOption[]>([])
  const [currentRole, setCurrentRole] = useState('')
  const [filter, setFilter] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [showCreatePanel, setShowCreatePanel] = useState(false)
  const [patientQuery, setPatientQuery] = useState('')
  const [patientMatches, setPatientMatches] = useState<PatientLookup[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientLookup | null>(null)
  const [createMedicationIds, setCreateMedicationIds] = useState<string[]>([])
  const [createRxNumber, setCreateRxNumber] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [pendingAction, setPendingAction] = useState<{
    type: 'status' | 'payment'
    orderId: string
    nextValue: string
    reason: string
  } | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/orders')
      const text = await res.text()
      let data: unknown = []
      try {
        data = text ? JSON.parse(text) : []
      } catch {
        data = []
      }

      if (!res.ok) {
        console.error('Failed to load admin orders', data)
        setOrders([])
        return
      }

      setOrders(Array.isArray(data) ? (data as Order[]) : [])
    } catch (err) {
      console.error('Failed to load admin orders', err)
      setOrders([])
    }
  }
  useEffect(() => {
    load()
    fetch('/api/me').then(r => r.json()).then(d => setCurrentRole(d.role ?? ''))
    fetch('/api/medications?active=true')
      .then(async (r) => {
        const text = await r.text()
        const data = text ? JSON.parse(text) : []
        setMedications(Array.isArray(data) ? data : [])
      })
      .catch(() => setMedications([]))
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      load()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (searchParams.get('addOrder') === '1') {
      setShowCreatePanel(true)
    }
  }, [searchParams])

  useEffect(() => {
    const query = patientQuery.trim()
    if (query.length < 2) {
      setPatientMatches([])
      return
    }

    let cancelled = false
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/staff/patients?q=${encodeURIComponent(query)}&limit=20`)
        const text = await res.text()
        const data = text ? JSON.parse(text) : []
        if (!res.ok || cancelled) return
        setPatientMatches(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setPatientMatches([])
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [patientQuery])

  function toggleCreateMedication(id: string) {
    setCreateMedicationIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= 2) {
        alert('You can select up to 2 medications.')
        return current
      }
      return [...current, id]
    })
  }

  async function createManualOrder() {
    if (!selectedPatient) {
      alert('Select a patient first.')
      return
    }
    if (createMedicationIds.length === 0) {
      alert('Select at least one medication.')
      return
    }

    setCreatingOrder(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          medicationIds: createMedicationIds,
          rxNumber: createRxNumber,
          providerNotes: createNotes,
        }),
      })
      const text = await res.text()
      let data: { error?: string } | null = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        const message = data?.error ?? (text?.trim() || 'Could not create order.')
        alert(message)
        setCreatingOrder(false)
        return
      }

      setShowCreatePanel(false)
      setCreateMedicationIds([])
      setCreateRxNumber('')
      setCreateNotes('')
      setSelectedPatient(null)
      setPatientQuery('')
      setPatientMatches([])
      await load()
      alert('Order created successfully.')
    } catch {
      alert('Could not create order right now. Please try again.')
    } finally {
      setCreatingOrder(false)
    }
  }

  function updateStatus(id: string, status: string, currentStatus: string) {
    if (status === currentStatus) return
    setPendingAction({ type: 'status', orderId: id, nextValue: status, reason: '' })
  }

  function updatePaymentState(id: string, paymentState: string, currentPaymentState: string) {
    if (paymentState === currentPaymentState) return
    setPendingAction({ type: 'payment', orderId: id, nextValue: paymentState, reason: '' })
  }

  async function submitPendingAction() {
    if (!pendingAction) return
    const reason = pendingAction.reason.trim()
    if (reason.length < 8) {
      alert('Reason must be at least 8 characters.')
      return
    }

    setUpdating(pendingAction.orderId)
    const body = pendingAction.type === 'status'
      ? { overrideStatus: pendingAction.nextValue, overrideReason: reason }
      : { paymentState: pendingAction.nextValue, paymentStateReason: reason }

    try {
      const res = await fetch(`/api/orders/${pendingAction.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      let data: { error?: string } | null = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }
      if (!res.ok) {
        alert(data?.error ?? text ?? 'Update failed.')
        return
      }

      setPendingAction(null)
      load()
    } catch {
      alert('Update failed. Please try again.')
    } finally {
      setUpdating(null)
    }
  }

  const safeOrders = Array.isArray(orders) ? orders : []
  const filtered = filter ? safeOrders.filter(o => o.status === filter) : safeOrders
  const visibleOrders = filtered.filter((o) => o.paymentState !== 'VOIDED')
  const activeOrders = visibleOrders.filter((o) => o.status !== 'COMPLETED')
  const completedOrders = visibleOrders.filter((o) => o.status === 'COMPLETED')
  const voidedOrders = filtered.filter((o) => o.paymentState === 'VOIDED')

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => setShowCreatePanel((v) => !v)}>
            {showCreatePanel ? 'Close Add Order' : '+ Add Order'}
          </button>
          <h1 className="text-2xl font-bold">All Orders</h1>
        </div>
        <select className="input w-48" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      {showCreatePanel && (
        <div className="card mb-6 space-y-3">
          <h2 className="font-semibold text-gray-700">Create Order For Existing Patient</h2>
          <input
            className="input"
            placeholder="Search patient name, email, or phone"
            value={patientQuery}
            onChange={(e) => setPatientQuery(e.target.value)}
          />
          {patientMatches.length > 0 && (
            <div className="max-h-40 space-y-2 overflow-auto rounded border border-gray-200 p-2">
              {patientMatches.map((patient) => (
                <button
                  type="button"
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient)
                    setPatientQuery(patient.name)
                    setPatientMatches([])
                  }}
                  className={`w-full rounded px-2 py-1 text-left text-sm ${selectedPatient?.id === patient.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'}`}
                >
                  <div className="font-medium">{patient.name}</div>
                  <div className="text-xs text-gray-500">{patient.email}</div>
                </button>
              ))}
            </div>
          )}
          {selectedPatient && (
            <div className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Selected: <span className="font-medium text-gray-800">{selectedPatient.name}</span>
            </div>
          )}
          <div>
            <label className="label">Medication Selection (up to 2)</label>
            <div className="max-h-40 space-y-2 overflow-auto rounded border border-gray-200 p-2">
              {medications.map((med) => (
                <label key={med.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{med.name}</span>
                  <input
                    type="checkbox"
                    checked={createMedicationIds.includes(med.id)}
                    onChange={() => toggleCreateMedication(med.id)}
                  />
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Rx Number (optional)</label>
            <input className="input" value={createRxNumber} onChange={(e) => setCreateRxNumber(e.target.value)} placeholder="RX-2026-0001" />
          </div>
          <div>
            <label className="label">Order Notes (optional)</label>
            <textarea className="input" rows={2} value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Notes for provider, pharmacy, and patient" />
          </div>
          <button className="btn-primary" disabled={creatingOrder} onClick={createManualOrder}>
            {creatingOrder ? 'Creating…' : 'Create Order'}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {activeOrders.map(o => (
          <div key={o.id} className="card">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{o.patient?.user?.name}</span>
                  <span className="text-gray-400 text-sm">{o.patient?.user?.email}</span>
                  {o.influencer && <span className="badge-blue text-xs">via {o.influencer.user.name} ({o.influencer.code})</span>}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {o.medication?.name ?? 'No medication selected'} · {o.paymentState}{o.amountPaid != null ? ` ($${o.amountPaid} captured)` : ''}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Order: {getOrderRef(o.orderNumber, o.id)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={BADGE[o.status] ?? 'badge-gray'}>{o.status.replace(/_/g,' ')}</span>
                <select
                  className="input py-1 text-xs"
                  value={o.status}
                  onChange={e => updateStatus(o.id, e.target.value, o.status)}
                  disabled={updating === o.id}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option
                      key={s}
                      value={s}
                      disabled={
                        currentRole !== 'MASTER_ADMIN' &&
                        (
                          (['PHARMACY_PENDING', 'SHIPPED', 'CANCELLED'].includes(s)) ||
                          (s === 'COMPLETED' && !(currentRole === 'ADMIN' && o.paymentState === 'PAID'))
                        )
                      }
                    >
                      {s.replace(/_/g,' ')}
                    </option>
                  ))}
                </select>
                <select
                  className="input py-1 text-xs"
                  value={o.paymentState}
                  onChange={e => updatePaymentState(o.id, e.target.value, o.paymentState)}
                  disabled={updating === o.id}
                >
                  {['UNPAID', 'PAID', 'REFUNDED', 'VOIDED'].map(s => (
                    <option key={s} value={s} disabled={currentRole !== 'MASTER_ADMIN' && ['REFUNDED', 'VOIDED'].includes(s)}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}
        {activeOrders.length === 0 && <div className="card text-center text-gray-400 py-10">No active orders found.</div>}
      </div>

      {completedOrders.length > 0 && (
        <div className="mt-6 card">
          <details>
            <summary className="cursor-pointer font-medium text-sm text-gray-700">Completed Orders ({completedOrders.length})</summary>
            <div className="mt-4 space-y-3">
              {completedOrders.map((o) => (
                <div key={o.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{o.patient?.user?.name}</span>
                        <span className="text-gray-400 text-xs">{o.patient?.user?.email}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {o.medication?.name ?? 'No medication selected'} · {o.paymentState}{o.amountPaid != null ? ` ($${o.amountPaid} captured)` : ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Order: {getOrderRef(o.orderNumber, o.id)}</div>
                    </div>
                    <span className="badge-green text-xs">COMPLETED</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {voidedOrders.length > 0 && (
        <div className="mt-6 card">
          <details>
            <summary className="cursor-pointer font-medium text-sm text-gray-700">Voided Prescriptions ({voidedOrders.length})</summary>
            <div className="mt-4 space-y-3">
              {voidedOrders.map((o) => (
                <div key={o.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{o.patient?.user?.name}</span>
                        <span className="text-gray-400 text-xs">{o.patient?.user?.email}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {o.medication?.name ?? 'No medication selected'} · {o.paymentState}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Order: {getOrderRef(o.orderNumber, o.id)}</div>
                    </div>
                    <span className="badge-red text-xs">VOIDED</span>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Reason required</h2>
            <p className="mt-1 text-sm text-gray-600">
              {pendingAction.type === 'status'
                ? `Confirm status correction to ${pendingAction.nextValue.replace(/_/g, ' ')}.`
                : `Confirm payment state change to ${pendingAction.nextValue}.`}
            </p>
            <textarea
              className="input mt-3"
              rows={3}
              placeholder="Enter reason (minimum 8 characters)"
              value={pendingAction.reason}
              onChange={(e) => setPendingAction({ ...pendingAction, reason: e.target.value })}
            />
            <div className="mt-4 flex gap-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => setPendingAction(null)}
                disabled={updating === pendingAction.orderId}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                onClick={submitPendingAction}
                disabled={updating === pendingAction.orderId}
              >
                {updating === pendingAction.orderId ? 'Applying…' : 'Apply Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
