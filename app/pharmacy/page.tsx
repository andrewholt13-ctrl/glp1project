'use client'

import { useCallback, useEffect, useState } from 'react'
import { getOrderRef } from '@/lib/orderRef'
import { isPrescriptionExpired } from '@/lib/prescriptionMeta'

type Order = {
  id: string; orderNumber: string | null; status: string; createdAt: string; rxNumber: string | null; trackingNumber: string | null
  providerNotes: string | null; patientNotes: string | null; pharmacyNotes: string | null
  amountPaid: number | null
  paymentState: 'UNPAID' | 'PAID' | 'REFUNDED' | 'VOIDED'
  prescriptionMeta?: {
    quantity: string
    refillsTotal: number
    refillsRemaining: number
    writtenDate: string
    prescribedAt: string
    expiresAt: string
    isDiscontinued: boolean
    discontinueReason: string | null
  } | null
  medication: { name: string; directions: string; quantity: string } | null
  patient: {
    address: string | null; city: string | null; state: string | null; zip: string | null
    user: { name: string; email: string; phone: string | null }
  }
}

type MedicationOption = { id: string; name: string; price: number }
type PatientLookup = { id: string; userId: string; name: string; email: string; phone: string | null }

const BADGE: Record<string, string> = {
  REFILL_REQUESTED:'badge-blue',
  PRESCRIBED:'badge-blue',PAID:'badge-green',PHARMACY_PENDING:'badge-yellow',SHIPPED:'badge-green',COMPLETED:'badge-green',
}

const STATUS_FLOW = ['REFILL_REQUESTED', 'PRESCRIBED', 'PHARMACY_PENDING', 'SHIPPED', 'COMPLETED']

export default function PharmacyDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [medications, setMedications] = useState<MedicationOption[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [tracking, setTracking] = useState('')
  const [pharmacyNote, setPharmacyNote] = useState('')
  const [updating, setUpdating] = useState(false)
  const [patientQuery, setPatientQuery] = useState('')
  const [patientMatches, setPatientMatches] = useState<PatientLookup[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientLookup | null>(null)
  const [createMedicationIds, setCreateMedicationIds] = useState<string[]>([])
  const [createRxNumber, setCreateRxNumber] = useState('')
  const [createNotes, setCreateNotes] = useState('')
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [viewMode, setViewMode] = useState<'create' | 'active' | 'onHold' | 'shipped' | 'completed'>('active')

  const load = useCallback(async (selectedOrderId?: string) => {
    try {
      const res = await fetch('/api/orders')
      const text = await res.text()
      const data = text ? JSON.parse(text) : []
      const nextOrders = Array.isArray(data) ? data.filter((o: Order) => STATUS_FLOW.includes(o.status)) : []
      setOrders(nextOrders)
      setSelected((current) => {
        const targetId = selectedOrderId ?? current?.id
        if (!targetId) return null
        const refreshed = nextOrders.find((order: Order) => order.id === targetId)
        if (!refreshed) return null
        setTracking(refreshed.trackingNumber ?? '')
        setPharmacyNote(refreshed.pharmacyNotes ?? '')
        return refreshed
      })
    } catch (err) {
      console.error('Failed to load pharmacy orders', err)
      setOrders([])
      setSelected(null)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/medications?active=true')
      .then(async (r) => {
        const text = await r.text()
        const data = text ? JSON.parse(text) : []
        setMedications(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        setMedications([])
      })
  }, [])

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

  async function updateOrder(id: string, updates: Record<string, unknown>) {
    setUpdating(true)
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const text = await res.text()
    let data: { error?: string } | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }

    if (!res.ok) {
      alert(data?.error ?? text ?? 'Could not update order status.')
      setUpdating(false)
      return
    }

    await load(id)
    setUpdating(false)
  }

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
      let data: { id?: string; error?: string } | null = null
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

      setCreateMedicationIds([])
      setCreateRxNumber('')
      setCreateNotes('')
      setSelectedPatient(null)
      setPatientQuery('')
      setPatientMatches([])
      await load(data?.id)
      alert('Order created and visible in pharmacy, provider, and patient portals.')
    } catch {
      alert('Could not create order right now. Please try again.')
    } finally {
      setCreatingOrder(false)
    }
  }

  function actionClass(targetStatus: string, primary = false) {
    const isActive = selected?.status === targetStatus
    if (isActive) {
      return primary
        ? 'btn-primary text-xs ring-2 ring-brand-300'
        : 'btn-secondary text-xs bg-brand-50 text-brand-700 ring-2 ring-brand-300'
    }
    return primary ? 'btn-primary text-xs' : 'btn-secondary text-xs'
  }

  const active = orders.filter(o => o.status !== 'COMPLETED')
  const activeCore = orders.filter((o) => ['REFILL_REQUESTED', 'PRESCRIBED'].includes(o.status))
  const onHold = orders.filter((o) => o.status === 'PHARMACY_PENDING')
  const shipped = orders.filter((o) => o.status === 'SHIPPED')
  const completed = orders.filter(o => o.status === 'COMPLETED')
  const visibleOrders =
    viewMode === 'completed'
      ? completed
      : viewMode === 'onHold'
        ? onHold
        : viewMode === 'shipped'
          ? shipped
          : activeCore

  function getDisplayStatus(order: Order) {
    if (order.status === 'PRESCRIBED' && order.paymentState === 'PAID') return 'PAID'
    return order.status
  }

  function sidebarButtonClass(mode: 'create' | 'active' | 'onHold' | 'shipped' | 'completed') {
    return viewMode === mode
      ? 'rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white'
      : 'rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Pharmacy Queue</h1>
        <p className="mt-1 text-sm text-gray-500">Manage active prescriptions, completed orders, and create new patient orders.</p>
      </div>

      <div className="card">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Queue Views</div>
        <div className="flex flex-wrap gap-2">
          <button className={sidebarButtonClass('create')} onClick={() => setViewMode('create')}>
            Create Order
          </button>
          <button className={sidebarButtonClass('active')} onClick={() => setViewMode('active')}>
            Active Orders ({activeCore.length})
          </button>
          <button className={sidebarButtonClass('onHold')} onClick={() => setViewMode('onHold')}>
            On Hold ({onHold.length})
          </button>
          <button className={sidebarButtonClass('shipped')} onClick={() => setViewMode('shipped')}>
            Shipped ({shipped.length})
          </button>
          <button className={sidebarButtonClass('completed')} onClick={() => setViewMode('completed')}>
            Completed Orders ({completed.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">

        <div className="col-span-12 lg:col-span-4 space-y-3">
          {(viewMode === 'active' || viewMode === 'onHold' || viewMode === 'shipped' || viewMode === 'completed') && (
            <>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm">
                {viewMode === 'completed'
                  ? `Completed Orders (${completed.length})`
                  : viewMode === 'onHold'
                    ? `On Hold Orders (${onHold.length})`
                    : viewMode === 'shipped'
                      ? `Shipped Orders (${shipped.length})`
                      : `Active Orders (${activeCore.length})`}
              </div>

              {visibleOrders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => {
                    setSelected(o)
                    setTracking(o.trackingNumber ?? '')
                    setPharmacyNote(o.pharmacyNotes ?? '')
                  }}
                  className={`card cursor-pointer hover:shadow-md transition-shadow ${selected?.id === o.id ? 'ring-2 ring-brand-500' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">{o.patient?.user?.name}</div>
                      <div className="text-xs text-gray-500">Order: {getOrderRef(o.orderNumber, o.id)}</div>
                      {o.prescriptionMeta && (
                        <div className="text-xs text-gray-500">
                          Refills: {o.prescriptionMeta.refillsRemaining}/{o.prescriptionMeta.refillsTotal}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">{o.medication?.name ?? '—'}</div>
                      {o.rxNumber && <div className="text-xs font-mono text-brand-600">Rx: {o.rxNumber}</div>}
                    </div>
                    <span className={BADGE[getDisplayStatus(o)] ?? 'badge-gray text-xs'}>{getDisplayStatus(o).replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}

              {visibleOrders.length === 0 && (
                <div className="card text-center text-gray-400 py-6 text-sm">
                  {viewMode === 'completed' ? 'No completed orders yet.' : 'No active orders in queue.'}
                </div>
              )}
            </>
          )}
        </div>

        <div className="col-span-12 lg:col-span-8">
          {viewMode === 'create' ? (
            <div className="card space-y-3">
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
                <textarea className="input" rows={2} value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Notes for provider and patient" />
              </div>
              <button className="btn-primary w-full" disabled={creatingOrder} onClick={createManualOrder}>
                {creatingOrder ? 'Creating…' : 'Create Order'}
              </button>
            </div>
          ) : selected ? (
            <div className="card space-y-4">
              <h2 className="font-semibold text-lg">{selected.patient?.user?.name}</h2>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Order Number</span><div>{getOrderRef(selected.orderNumber, selected.id)}</div></div>
                <div><span className="text-gray-400">Phone</span><div>{selected.patient.user.phone ?? '—'}</div></div>
                <div><span className="text-gray-400">Email</span><div>{selected.patient.user.email}</div></div>
                <div className="col-span-2">
                  <span className="text-gray-400">Ship To</span>
                  <div>{[selected.patient.address, selected.patient.city, selected.patient.state, selected.patient.zip].filter(Boolean).join(', ') || '—'}</div>
                </div>
                <div><span className="text-gray-400">Payment</span><div>{selected.paymentState}{selected.amountPaid != null ? ` ($${selected.amountPaid.toFixed(2)})` : ''}</div></div>
              </div>

              {selected.medication && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="font-medium">{selected.medication.name}</div>
                  <div className="text-gray-500">Qty: {selected.medication.quantity}</div>
                  {selected.prescriptionMeta?.quantity && <div className="text-gray-500">Prescribed Qty Override: {selected.prescriptionMeta.quantity}</div>}
                  {selected.prescriptionMeta && <div className="text-gray-500">Refills Remaining: {selected.prescriptionMeta.refillsRemaining} / {selected.prescriptionMeta.refillsTotal}</div>}
                  {selected.prescriptionMeta && <div className="text-gray-500">Rx Expires: {new Date(selected.prescriptionMeta.expiresAt).toLocaleDateString()}</div>}
                  {selected.prescriptionMeta && isPrescriptionExpired(selected.prescriptionMeta) && (
                    <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 ring-1 ring-red-200">Refills are expired.</div>
                  )}
                  <div className="text-gray-500">Directions: {selected.medication.directions}</div>
                  {selected.rxNumber && <div className="font-mono text-brand-600 text-xs">Rx# {selected.rxNumber}</div>}
                </div>
              )}

              <div className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800 ring-1 ring-indigo-200 space-y-2">
                <div><strong>Pharmacy Notes</strong></div>
                <textarea
                  className="input"
                  rows={3}
                  value={pharmacyNote}
                  onChange={(e) => setPharmacyNote(e.target.value)}
                  placeholder="Add pharmacy-only notes for this order"
                />
                <div className="flex justify-end">
                  <button
                    className="btn-secondary text-xs"
                    disabled={updating}
                    onClick={() => updateOrder(selected.id, { pharmacyNotes: pharmacyNote })}
                  >
                    Save Pharmacy Note
                  </button>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h3 className="font-medium text-sm">Update Order Status</h3>

                {selected.status === 'REFILL_REQUESTED' && (
                  <button
                    className="btn-primary text-xs w-full"
                    disabled={updating}
                    onClick={() => updateOrder(selected.id, { status: 'PRESCRIBED' })}
                  >
                    ✓ Approve Refill & Request Payment
                  </button>
                )}

                <div>
                  <label className="label">Tracking Number (optional)</label>
                  <input className="input" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="1Z999AA10123456784" />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    className={actionClass('PHARMACY_PENDING')}
                    disabled={updating || !['PRESCRIBED', 'PHARMACY_PENDING'].includes(selected.status)}
                    onClick={() => updateOrder(selected.id, { status: 'PHARMACY_PENDING', ...(tracking ? { trackingNumber: tracking } : {}) })}
                  >
                    Mark On Hold
                  </button>
                  <button
                    className={actionClass('PRESCRIBED')}
                    disabled={updating || selected.status !== 'PHARMACY_PENDING'}
                    onClick={() => updateOrder(selected.id, { status: 'PRESCRIBED' })}
                  >
                    Move to Active
                  </button>
                  <button
                    className={actionClass('SHIPPED')}
                    disabled={updating || !['PRESCRIBED', 'PHARMACY_PENDING', 'SHIPPED'].includes(selected.status)}
                    onClick={() => {
                      if (selected.paymentState !== 'PAID') {
                        alert('Must be paid before shipping.')
                        return
                      }
                      updateOrder(selected.id, { status: 'SHIPPED', ...(tracking ? { trackingNumber: tracking } : {}) })
                    }}
                  >
                    Mark Shipped
                  </button>
                  <button
                    className={actionClass('COMPLETED', true)}
                    disabled={updating || selected.paymentState !== 'PAID' || !['SHIPPED', 'COMPLETED'].includes(selected.status)}
                    onClick={() => updateOrder(selected.id, { status: 'COMPLETED', ...(tracking ? { trackingNumber: tracking } : {}) })}
                  >
                    ✓ Complete
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {viewMode !== 'completed' && (
                <div className="card text-center py-16 text-gray-400">
                  <div className="text-4xl mb-3">💊</div>
                  <div>Select an order from the queue to manage it.</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
