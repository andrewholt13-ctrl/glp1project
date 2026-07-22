'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { getOrderRef } from '@/lib/orderRef'

type PatientProfile = {
  dateOfBirth: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  weight: string | null
  height: string | null
  allergies: string | null
  currentMeds: string | null
  medicalHistory: string | null
  pcpSeen: boolean | null
  heartConditions: string | null
  endocrineConditions: string | null
  cancerHistory: string | null
  diabetesStatus: string | null
  giConditions: string | null
  referredBy: string | null
  user: { name: string; email: string; phone: string | null }
}

type Order = {
  id: string; orderNumber: string | null; status: string; createdAt: string; amountPaid: number | null; paidAt: string | null; paymentState: 'UNPAID' | 'PAID' | 'REFUNDED' | 'VOIDED'; trackingNumber: string | null
  providerNotes: string | null; patientNotes: string | null; pharmacyNotes: string | null
  medication: { id: string; name: string; price: number } | null
  orderMedications: Array<{ id: string; medication: { id: string; name: string; price: number } }>
  patient: PatientProfile
}

type MedicationOption = { id: string; name: string; price: number }
type PatientLookup = { id: string; userId: string; name: string; email: string; phone: string | null }

function normalizeList(value: string | null) {
  if (!value) return 'None reported'
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.length ? parsed.join(', ') : 'None reported'
    return String(parsed)
  } catch {
    return value
  }
}

function yesNo(value: boolean | null) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return 'Not answered'
}

const BADGE: Record<string, string> = {
  INTAKE_PENDING:'badge-yellow',PROVIDER_REVIEW:'badge-blue',PRESCRIBED:'badge-green',
  PAID:'badge-green',REFILL_REQUESTED:'badge-yellow',PHARMACY_PENDING:'badge-yellow',SHIPPED:'badge-green',COMPLETED:'badge-green',CANCELLED:'badge-red',
}

function getDisplayStatus(order: Order) {
  if (order.status === 'PRESCRIBED' && order.paymentState === 'PAID') return 'PAID'
  return order.status
}

export default function ProviderDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [medications, setMedications] = useState<MedicationOption[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [finalMedicationIds, setFinalMedicationIds] = useState<string[]>([])
  const [providerNotes, setProviderNotes] = useState('')
  const [patientNotes, setPatientNotes] = useState('')
  const [pharmacyNotes, setPharmacyNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [overrideStatus, setOverrideStatus] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [showAdminCorrectionModal, setShowAdminCorrectionModal] = useState(false)
  const [adminCorrectionReason, setAdminCorrectionReason] = useState('')
  const [adminCorrectionSaving, setAdminCorrectionSaving] = useState(false)
  const [patientQuery, setPatientQuery] = useState('')
  const [patientMatches, setPatientMatches] = useState<PatientLookup[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientLookup | null>(null)
  const [createMedicationIds, setCreateMedicationIds] = useState<string[]>([])
  const [createNotes, setCreateNotes] = useState('')
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [viewMode, setViewMode] = useState<'create' | 'needsReview' | 'pastPatients'>('needsReview')
  const [pastPatientSearch, setPastPatientSearch] = useState('')

  const load = useCallback(async (focusOrderId?: string) => {
    try {
      const res = await fetch('/api/orders')
      const text = await res.text()
      const data = text ? JSON.parse(text) : []
      if (!res.ok) {
        console.error('Failed to load provider orders', data)
        setOrders([])
        return
      }
      const nextOrders = Array.isArray(data) ? data : []
      setOrders(nextOrders)
      setSelected((current) => {
        const targetId = focusOrderId ?? current?.id
        if (!targetId) return null
        const refreshed = nextOrders.find((order) => order.id === targetId)
        return refreshed ?? null
      })
    } catch (err) {
      console.error('Failed to load provider orders', err)
      setOrders([])
    }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(() => {
      load()
    }, 10000)

    return () => clearInterval(interval)
  }, [load])
  useEffect(() => {
    fetch('/api/medications?active=true')
      .then(async (r) => {
        const text = await r.text()
        const data = text ? JSON.parse(text) : []
        setMedications(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error('Failed to load medications', err)
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
      setCreateNotes('')
      setSelectedPatient(null)
      setPatientQuery('')
      setPatientMatches([])
      await load(data?.id)
      alert('Order created and visible in provider, pharmacy, and patient portals.')
    } catch {
      alert('Could not create order right now. Please try again.')
    } finally {
      setCreatingOrder(false)
    }
  }

  function selectOrder(o: Order) {
    setSelected(o)
    setFinalMedicationIds(o.orderMedications.map(item => item.medication.id).slice(0, 2))
    setProviderNotes(o.providerNotes ?? '')
    setPatientNotes(o.patientNotes ?? '')
    setPharmacyNotes(o.pharmacyNotes ?? '')
    setOverrideStatus(o.status)
    setOverrideReason('')
  }

  async function prescribe() {
    if (!selected) return
    if (finalMedicationIds.length === 0) {
      alert('Select at least 1 final medication before issuing prescription.')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/orders/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PRESCRIBED', providerNotes, patientNotes, pharmacyNotes, finalMedicationIds }),
    })
    const text = await res.text()
    let data: { error?: string } | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!res.ok) {
      alert(data?.error ?? text ?? 'Could not issue prescription. Please try again.')
      setSaving(false)
      return
    }
    setSaving(false); setSelected(null); load()
  }

  async function markReview(id: string) {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PROVIDER_REVIEW' }),
    })
    load()
  }

  async function applyStatusOverride() {
    if (!selected) return
    if (!overrideStatus || overrideStatus === selected.status) {
      alert('Choose a different status to apply.')
      return
    }
    if (overrideReason.trim().length < 8) {
      alert('Please provide a clear reason (at least 8 characters).')
      return
    }
    setOverrideSaving(true)
    const res = await fetch(`/api/orders/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrideStatus, overrideReason: overrideReason.trim() }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? 'Could not apply status correction.')
      setOverrideSaving(false)
      return
    }
    setOverrideSaving(false)
    setSelected(null)
    load()
  }

  async function reopenPrescriptionForReselect() {
    if (!selected) return
    const reason = 'Unprescribed by provider before payment to adjust medication selection.'
    setOverrideSaving(true)
    const res = await fetch(`/api/orders/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrideStatus: 'PROVIDER_REVIEW', overrideReason: reason }),
    })
    const text = await res.text()
    let data: { error?: string } | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!res.ok) {
      alert(data?.error ?? text ?? 'Could not reopen prescription for re-selection.')
      setOverrideSaving(false)
      return
    }
    setOverrideSaving(false)
    setSelected(null)
    load()
  }

  async function requestAdminCorrectionTicket() {
    if (!selected) return
    const reason = adminCorrectionReason.trim()
    if (reason.length < 8) {
      alert('Please provide at least 8 characters.')
      return
    }

    setAdminCorrectionSaving(true)

    const payload = {
      type: 'Website',
      name: 'Provider Team',
      email: selected.patient.user.email,
      subject: `Admin Correction Request - ${getOrderRef(selected.orderNumber, selected.id)}`,
      message: [
        `Provider requested admin correction.`,
        `Order ID: ${selected.id}`,
        `Order Number: ${getOrderRef(selected.orderNumber, selected.id)}`,
        `Patient: ${selected.patient.user.name}`,
        `Current Status: ${selected.status}`,
        `Payment State: ${selected.paymentState}`,
        `Reason: ${reason}`,
      ].join('\n'),
      orderId: selected.id,
      orderNumber: selected.orderNumber,
    }

    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? 'Could not submit admin correction ticket.')
      setAdminCorrectionSaving(false)
      return
    }
    setAdminCorrectionSaving(false)
    setShowAdminCorrectionModal(false)
    setAdminCorrectionReason('')
    alert(`Admin correction ticket submitted: ${data?.ticketNumber ?? 'Created'}`)
  }

  const pending = orders.filter(o => ['INTAKE_PENDING', 'PROVIDER_REVIEW'].includes(o.status))
  const past = orders.filter(o => !['INTAKE_PENDING', 'PROVIDER_REVIEW'].includes(o.status))
  const normalizedPastPatientSearch = pastPatientSearch.trim().toLowerCase()
  const filteredPast = normalizedPastPatientSearch
    ? past.filter((o) => {
        const haystack = [
          o.patient?.user?.name,
          o.patient?.user?.email,
          o.orderNumber,
          o.id,
          o.medication?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalizedPastPatientSearch)
      })
    : past

  function queueButtonClass(mode: 'create' | 'needsReview' | 'pastPatients') {
    return viewMode === mode
      ? 'rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white'
      : 'rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Provider Dashboard</h1>

      <div className="card">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Queue Views</div>
        <div className="flex flex-wrap gap-2">
          <button className={queueButtonClass('create')} onClick={() => setViewMode('create')}>
            Create Order
          </button>
          <button className={queueButtonClass('needsReview')} onClick={() => setViewMode('needsReview')}>
            Needs Review ({pending.length})
          </button>
          <button className={queueButtonClass('pastPatients')} onClick={() => setViewMode('pastPatients')}>
            Past Patients ({past.length})
          </button>
        </div>
        {viewMode === 'pastPatients' && (
          <div className="mt-3">
            <input
              className="input"
              placeholder="Search past patients by name, email, order, or medication"
              value={pastPatientSearch}
              onChange={(e) => setPastPatientSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Patient list */}
        <div className="col-span-2 space-y-3">
          {viewMode === 'create' && (
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
                <label className="label">Provider Notes (optional)</label>
                <textarea className="input" rows={2} value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Notes for patient and pharmacy" />
              </div>
              <button className="btn-primary w-full" disabled={creatingOrder} onClick={createManualOrder}>
                {creatingOrder ? 'Creating…' : 'Create Order'}
              </button>
            </div>
          )}

          {viewMode === 'needsReview' && (
            <>
              <h2 className="font-semibold text-gray-700">Needs Review ({pending.length})</h2>
              {pending.map(o => (
                <div
                  key={o.id}
                  onClick={() => selectOrder(o)}
                  className={`card cursor-pointer transition-shadow hover:shadow-md ${selected?.id === o.id ? 'ring-2 ring-brand-500' : ''}`}
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium">{o.patient?.user?.name}</div>
                      <div className="text-xs text-gray-500">Order: {getOrderRef(o.orderNumber, o.id)}</div>
                      <div className="text-xs text-gray-400">{o.patient?.user?.email}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{o.medication?.name ?? 'No medication'}</div>
                    </div>
                    <div>
                      <span className={BADGE[getDisplayStatus(o)] ?? 'badge-gray'}>{getDisplayStatus(o).replace('_',' ')}</span>
                    </div>
                  </div>
                </div>
              ))}
              {pending.length === 0 && <div className="card text-center text-gray-400 py-6 text-sm">No pending patients.</div>}
            </>
          )}

          {viewMode === 'pastPatients' && (
            <>
              <h2 className="font-semibold text-gray-700">Past Patients ({filteredPast.length})</h2>
              {filteredPast.map(o => (
                <div key={o.id} onClick={() => selectOrder(o)} className="card cursor-pointer opacity-70 hover:opacity-100">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium text-sm">{o.patient?.user?.name}</div>
                      <div className="text-xs text-gray-500">Order: {getOrderRef(o.orderNumber, o.id)}</div>
                      <div className="text-xs text-gray-400">{o.medication?.name}</div>
                    </div>
                    <span className={BADGE[getDisplayStatus(o)] ?? 'badge-gray text-xs'}>{getDisplayStatus(o).replace('_',' ')}</span>
                  </div>
                </div>
              ))}
              {filteredPast.length === 0 && <div className="card text-center text-gray-400 py-6 text-sm">No past patients match your search.</div>}
            </>
          )}
        </div>

        {/* Patient detail */}
        <div className="col-span-3">
          {selected ? (
            <div className="card space-y-4">
              <div className="flex justify-between items-start">
                <h2 className="font-semibold text-lg">{selected.patient?.user?.name}</h2>
                <span className={BADGE[getDisplayStatus(selected)] ?? 'badge-gray'}>{getDisplayStatus(selected).replace(/_/g,' ')}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400">Order Number</span><div>{getOrderRef(selected.orderNumber, selected.id)}</div></div>
                <div><span className="text-gray-400">Email</span><div>{selected.patient.user.email}</div></div>
                <div><span className="text-gray-400">Phone</span><div>{selected.patient.user.phone ?? '—'}</div></div>
                <div><span className="text-gray-400">Date of Birth</span><div>{selected.patient.dateOfBirth ?? '—'}</div></div>
                <div><span className="text-gray-400">Patient Recommended</span><div>{selected.orderMedications.length > 0 ? selected.orderMedications.map(item => item.medication.name).join(', ') : 'No recommendation provided'}</div></div>
                <div><span className="text-gray-400">Weight</span><div>{selected.patient.weight ?? '—'}</div></div>
                <div><span className="text-gray-400">Height</span><div>{selected.patient.height ?? '—'}</div></div>
                <div><span className="text-gray-400">Address</span><div>{selected.patient.address || '—'}</div></div>
                <div><span className="text-gray-400">City / State / ZIP</span><div>{[selected.patient.city, selected.patient.state, selected.patient.zip].filter(Boolean).join(', ') || '—'}</div></div>
                <div><span className="text-gray-400">PCP Visit Past Year</span><div>{yesNo(selected.patient.pcpSeen)}</div></div>
                <div><span className="text-gray-400">Referral Code</span><div>{selected.patient.referredBy || 'None'}</div></div>
                <div><span className="text-gray-400">Payment</span><div>{selected.paymentState}{selected.amountPaid != null ? ` ($${selected.amountPaid.toFixed(2)})` : ''}</div></div>
                <div><span className="text-gray-400">Shipping</span><div>{selected.status === 'SHIPPED' || selected.status === 'COMPLETED' ? `Shipped${selected.trackingNumber ? ` (${selected.trackingNumber})` : ''}` : 'Not shipped'}</div></div>
              </div>

              <div className="space-y-2 text-sm">
                <div><span className="text-gray-400 block">Allergies</span><div className="bg-gray-50 rounded p-2">{selected.patient.allergies || 'None reported'}</div></div>
                <div><span className="text-gray-400 block">Current Medications</span><div className="bg-gray-50 rounded p-2">{selected.patient.currentMeds || 'None reported'}</div></div>
                <div><span className="text-gray-400 block">Relevant Medical History</span><div className="bg-gray-50 rounded p-2">{selected.patient.medicalHistory || 'None reported'}</div></div>
                <div><span className="text-gray-400 block">Heart / Cardiac Conditions</span><div className="bg-gray-50 rounded p-2">{normalizeList(selected.patient.heartConditions)}</div></div>
                <div><span className="text-gray-400 block">Endocrine / Kidney / Liver Conditions</span><div className="bg-gray-50 rounded p-2">{normalizeList(selected.patient.endocrineConditions)}</div></div>
                <div><span className="text-gray-400 block">Cancer History</span><div className="bg-gray-50 rounded p-2">{selected.patient.cancerHistory || 'None reported'}</div></div>
                <div><span className="text-gray-400 block">Diabetes Status</span><div className="bg-gray-50 rounded p-2">{selected.patient.diabetesStatus || 'None reported'}</div></div>
                <div><span className="text-gray-400 block">GI / Digestive History</span><div className="bg-gray-50 rounded p-2">{normalizeList(selected.patient.giConditions)}</div></div>
              </div>

              {['INTAKE_PENDING', 'PROVIDER_REVIEW'].includes(selected.status) && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-medium">Write Prescription</h3>
                  <div>
                    <label className="label">Final Medication Selection (Provider Decision)</label>
                    <p className="text-xs text-gray-500 mb-2">Select up to 2 medications to prescribe.</p>
                    <div className="space-y-2 rounded border border-gray-200 p-3 max-h-56 overflow-auto">
                      {medications.map((med) => (
                        <label key={med.id} className="flex items-center justify-between gap-3">
                          <span className="text-sm">{med.name}</span>
                          <input
                            type="checkbox"
                            checked={finalMedicationIds.includes(med.id)}
                            onChange={() => {
                              setFinalMedicationIds((current) => {
                                if (current.includes(med.id)) return current.filter((id) => id !== med.id)
                                if (current.length >= 2) {
                                  alert('You can prescribe up to 2 medications.')
                                  return current
                                }
                                return [...current, med.id]
                              })
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Provider Notes</label>
                    <textarea
                      className="input"
                      rows={2}
                      value={providerNotes}
                      onChange={e => setProviderNotes(e.target.value)}
                      placeholder="Internal provider notes"
                    />
                  </div>
                  <div>
                    <label className="label">Patient Notes (visible to patient)</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={patientNotes}
                      onChange={e => setPatientNotes(e.target.value)}
                      placeholder="Message for patient to read in their portal"
                    />
                  </div>
                  <div>
                    <label className="label">Pharmacy Notes (visible to pharmacy)</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={pharmacyNotes}
                      onChange={e => setPharmacyNotes(e.target.value)}
                      placeholder="Dispensing and fulfillment instructions"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Issuing a prescription will prompt patient payment. Pharmacy fulfillment begins only after payment is received.</p>
                  <div className="flex gap-2">
                    {selected.status === 'INTAKE_PENDING' && (
                      <button className="btn-secondary flex-1" onClick={() => markReview(selected.id)}>Mark Under Review</button>
                    )}
                    <button className="btn-primary flex-1" onClick={prescribe} disabled={saving}>
                      {saving ? 'Sending…' : '✓ Issue Prescription & Request Payment'}
                    </button>
                  </div>
                </div>
              )}

              {selected.status === 'PRESCRIBED' && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-medium">Prescription Re-selection</h3>
                  {selected.paymentState === 'UNPAID' && (selected.amountPaid == null || selected.amountPaid <= 0) ? (
                    <>
                      <p className="text-xs text-gray-500">Patient has not paid yet. You can reopen this case, reselect medications, and submit again.</p>
                      <button className="btn-secondary w-full" onClick={reopenPrescriptionForReselect} disabled={overrideSaving}>
                        {overrideSaving ? 'Reopening…' : 'Reopen For Medication Re-selection'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-amber-700 rounded bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
                        Payment activity exists on this order. Provider cannot reverse prescribed medications. Request admin correction.
                      </p>
                      <button
                        className="btn-secondary w-full"
                        onClick={() => {
                          setAdminCorrectionReason('')
                          setShowAdminCorrectionModal(true)
                        }}
                      >
                        Request Admin Correction
                      </button>
                    </>
                  )}
                </div>
              )}

              {showAdminCorrectionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
                    <h3 className="text-lg font-semibold">Admin correction reason</h3>
                    <p className="mt-1 text-sm text-gray-600">Provide a brief reason (minimum 8 characters).</p>
                    <textarea
                      className="input mt-3"
                      rows={3}
                      placeholder="Reason for admin correction request"
                      value={adminCorrectionReason}
                      onChange={(e) => setAdminCorrectionReason(e.target.value)}
                    />
                    <div className="mt-4 flex gap-2">
                      <button
                        className="btn-secondary flex-1"
                        onClick={() => setShowAdminCorrectionModal(false)}
                        disabled={adminCorrectionSaving}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-primary flex-1"
                        onClick={requestAdminCorrectionTicket}
                        disabled={adminCorrectionSaving}
                      >
                        {adminCorrectionSaving ? 'Submitting…' : 'Submit Request'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <h3 className="font-medium">Status Correction (Provider)</h3>
                <p className="text-xs text-gray-500">Use only when payment processing or fulfillment workflow needs manual correction. A reason is required and audit logged.</p>
                <div>
                  <label className="label">New Status</label>
                  <select className="input" value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value)}>
                    {['INTAKE_PENDING', 'PROVIDER_REVIEW', 'PRESCRIBED'].map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Reason for Change (required)</label>
                  <textarea className="input" rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Payment reversal, duplicate charge remediation, shipment exception, etc." />
                </div>
                <button className="btn-secondary w-full" onClick={applyStatusOverride} disabled={overrideSaving}>
                  {overrideSaving ? 'Applying…' : 'Apply Status Correction'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">👈</div>
              <div>Select a patient to review their intake and issue a prescription.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
