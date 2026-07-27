'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { getOrderRef } from '@/lib/orderRef'
import { isPrescriptionExpired } from '@/lib/prescriptionMeta'

type OrderStatus =
  | 'INTAKE_PENDING'
  | 'PROVIDER_REVIEW'
  | 'REFILL_REQUESTED'
  | 'PRESCRIBED'
  | 'PHARMACY_PENDING'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'

type Order = {
  id: string
  orderNumber: string | null
  status: OrderStatus
  createdAt: string
  updatedAt: string
  medication: { name: string; price: number; directions: string; quantity: string; handoutUrl?: string | null } | null
  provider: {
    user: { name: string }
    specialty: string | null
    npiNumber: string | null
  } | null
  pharmacy: { user: { name: string }; phone: string | null; address: string | null } | null
  rxNumber: string | null
  trackingNumber: string | null
  providerNotes: string | null
  patientNotes: string | null
  pharmacyNotes: string | null
  amountPaid: number | null
  paidAt: string | null
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
}

const STATUS_STEPS: OrderStatus[] = [
  'INTAKE_PENDING',
  'PROVIDER_REVIEW',
  'REFILL_REQUESTED',
  'PRESCRIBED',
  'PHARMACY_PENDING',
  'SHIPPED',
  'COMPLETED',
]

const STATUS_LABELS: Record<OrderStatus, string> = {
  INTAKE_PENDING:   'Intake Submitted',
  PROVIDER_REVIEW:  'Provider Review',
  REFILL_REQUESTED: 'Refill Requested',
  PRESCRIBED:       'Prescription Written',
  PHARMACY_PENDING: 'At Pharmacy',
  SHIPPED:          'Shipped',
  COMPLETED:        'Completed',
  CANCELLED:        'Cancelled',
}

const STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  INTAKE_PENDING:   'Your intake form is submitted and awaiting provider assignment.',
  PROVIDER_REVIEW:  'A licensed provider is reviewing your information.',
  REFILL_REQUESTED: 'Your refill request was sent to pharmacy and is pending approval.',
  PRESCRIBED:       'Your prescription is finalized. Complete payment to release your order to pharmacy.',
  PHARMACY_PENDING: 'The pharmacy is preparing your medication.',
  SHIPPED:          'Your medication has been shipped!',
  COMPLETED:        'Your order is complete. Enjoy your program!',
  CANCELLED:        'This order was cancelled. Please contact support.',
}

export default function StatusPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedActiveOrderId, setSelectedActiveOrderId] = useState<string | null>(null)
  const [requestingRefillFor, setRequestingRefillFor] = useState<string | null>(null)

  const loadOrders = useCallback(async () => {
    if (!session?.user.id) return
    try {
      const res = await fetch('/api/patients/orders')
      const text = await res.text()
      let data: unknown = []
      try {
        data = text ? JSON.parse(text) : []
      } catch {
        data = []
      }

      if (!res.ok) {
        console.error('Failed to load patient orders', data)
        setOrders([])
        setLoading(false)
        return
      }

      setOrders(Array.isArray(data) ? (data as Order[]) : [])
      setLoading(false)
    } catch (err) {
      console.error('Failed to load patient orders', err)
      setOrders([])
      setLoading(false)
    }
  }, [session?.user.id])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    if (!session?.user.id) return
    const interval = setInterval(() => {
      loadOrders()
    }, 10000)

    return () => clearInterval(interval)
  }, [loadOrders, session?.user.id])

  async function requestRefill(orderId: string) {
    try {
      setRequestingRefillFor(orderId)
      const res = await fetch(`/api/orders/${orderId}/refill`, { method: 'POST' })
      const text = await res.text()
      let data: { error?: string; message?: string } | null = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }
      if (!res.ok) {
        alert(data?.error ?? text ?? 'Could not submit refill request.')
        setRequestingRefillFor(null)
        return
      }
      alert(data?.message ?? 'Refill request sent to pharmacy queue.')
      window.location.reload()
    } catch {
      alert('Could not submit refill request.')
    } finally {
      setRequestingRefillFor(null)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && !loading && orders.length === 0) {
      router.replace('/medication-selection')
    }
  }, [status, loading, orders.length, router])

  const activeOrders = orders.filter((o) => !['SHIPPED', 'COMPLETED', 'CANCELLED'].includes(o.status))

  useEffect(() => {
    if (activeOrders.length === 0) {
      setSelectedActiveOrderId(null)
      return
    }
    if (!selectedActiveOrderId || !activeOrders.some((o) => o.id === selectedActiveOrderId)) {
      setSelectedActiveOrderId(activeOrders[0].id)
    }
  }, [activeOrders, selectedActiveOrderId])

  if (status === 'loading' || loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  }

  if (orders.length === 0) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Redirecting…</div>
  }

  const activeOrder =
    activeOrders.find((o) => o.id === selectedActiveOrderId) ??
    activeOrders[0] ??
    null
  const shippedOrders = orders.filter((o) => o.status === 'SHIPPED')
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED')

  const orderCountLabel = activeOrders.length === 1 ? 'order' : 'orders'

  const order = activeOrder

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-brand-700">💊 Butter Health</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Hi, {session?.user.name?.split(' ')[0]}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold">Your Program Status</h1>

        {activeOrders.length > 0 && (
          <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            You have <span className="font-semibold">{activeOrders.length}</span> pending {orderCountLabel} for your review.
          </div>
        )}

        {activeOrders.length > 1 && (
          <div className="card">
            <details>
              <summary className="cursor-pointer font-semibold text-gray-700">Active Orders ({activeOrders.length})</summary>
              <div className="mt-3 space-y-2">
                {activeOrders.map((active) => (
                  <button
                    key={active.id}
                    type="button"
                    onClick={() => setSelectedActiveOrderId(active.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      activeOrder?.id === active.id
                        ? 'border-brand-300 bg-brand-50 text-brand-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Order {getOrderRef(active.orderNumber, active.id)}</span>
                      <span className="text-xs text-gray-500">{STATUS_LABELS[active.status]}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Updated {new Date(active.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </details>
          </div>
        )}

        {!order && shippedOrders.length === 0 && completedOrders.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-gray-500">No active orders found.</p>
            <a href="/" className="btn-primary mt-4 inline-block">Start a Program</a>
          </div>
        ) : (
          <>
            {order && (
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-4">Order Progress</h2>
              <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                Order reference: <span className="font-mono font-medium">{getOrderRef(order.orderNumber, order.id)}</span>
              </div>
              {order.status === 'CANCELLED' ? (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-red-700 text-sm">This order was cancelled. Please contact support.</div>
              ) : (
                <div className="space-y-3">
                  {STATUS_STEPS.map((s, i) => {
                    const currentIdx = STATUS_STEPS.indexOf(order.status as OrderStatus)
                    const isDone = i <= currentIdx
                    const isCurrent = i === currentIdx
                    return (
                      <div key={s} className="flex items-start gap-3">
                        <div className={`mt-0.5 w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${isDone ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                          {isDone && !isCurrent ? '✓' : i + 1}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${isCurrent ? 'text-brand-700' : isDone ? 'text-gray-700' : 'text-gray-400'}`}>
                            {STATUS_LABELS[s]}
                            {isCurrent && <span className="ml-2 badge-green">Current</span>}
                          </div>
                          {isCurrent && <div className="text-xs text-gray-500 mt-0.5">{STATUS_DESCRIPTIONS[s]}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            )}

            {order?.medication && (
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Medication</h2>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Prescribed</span><span className="font-medium">{order.medication.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Quantity</span><span className="font-medium">{order.medication.quantity}</span></div>
                  {order.prescriptionMeta && (
                    <>
                      <div className="flex justify-between"><span className="text-gray-500">Refills Remaining</span><span className="font-medium">{order.prescriptionMeta.refillsRemaining} / {order.prescriptionMeta.refillsTotal}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Prescription Expires</span><span className="font-medium">{new Date(order.prescriptionMeta.expiresAt).toLocaleDateString()}</span></div>
                    </>
                  )}
                  {order.rxNumber && <div className="flex justify-between"><span className="text-gray-500">Rx #</span><span className="font-mono font-medium">{order.rxNumber}</span></div>}
                  {order.trackingNumber && <div className="flex justify-between"><span className="text-gray-500">Tracking</span><span className="font-mono font-medium">{order.trackingNumber}</span></div>}
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600"><strong>Directions:</strong> {order.medication.directions}</div>
                  {order.medication.handoutUrl && (
                    <div className="mt-4">
                      <a href={order.medication.handoutUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                        View Drug Information Handout
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {order?.provider && (
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Your Provider</h2>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{order.provider.user.name}</span></div>
                  {order.provider.specialty && <div className="flex justify-between"><span className="text-gray-500">Specialty</span><span className="font-medium">{order.provider.specialty}</span></div>}
                  {order.provider.npiNumber && <div className="flex justify-between"><span className="text-gray-500">NPI</span><span className="font-mono font-medium">{order.provider.npiNumber}</span></div>}
                  {order.patientNotes && <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-800"><strong>Patient Note:</strong> {order.patientNotes}</div>}
                </div>
              </div>
            )}

            {order?.pharmacy && (
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Pharmacy</h2>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{order.pharmacy.user.name}</span></div>
                  {order.pharmacy.phone && <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium">{order.pharmacy.phone}</span></div>}
                  {order.pharmacy.address && <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="font-medium">{order.pharmacy.address}</span></div>}
                </div>
              </div>
            )}

            {order && (
            <div className="card">
              <h2 className="font-semibold text-gray-700 mb-3">Payment</h2>
              {order.status === 'PRESCRIBED' && order.amountPaid == null && (
                <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
                  Ready to pay: your provider completed your treatment plan. Payment is required before pharmacy shipping can begin.
                </div>
              )}
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">{order.amountPaid != null ? `$${order.amountPaid.toFixed(2)}` : 'Pending'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className={order.paymentState === 'PAID' ? 'badge-green' : order.paymentState === 'UNPAID' ? 'badge-yellow' : 'badge-red'}>{order.paymentState}</span></div>
              </div>
              {order.paymentState === 'UNPAID' && order.status === 'PRESCRIBED' && (
                <a href={`/payment?orderId=${order.id}`} className="btn-primary mt-4 w-full text-center block">Complete Payment →</a>
              )}
              {order.paymentState === 'UNPAID' && order.status !== 'PRESCRIBED' && (
                <p className="text-xs text-gray-500 mt-3">Payment link will unlock after your provider finalizes your prescription.</p>
              )}
              {(order.paymentState === 'REFUNDED' || order.paymentState === 'VOIDED') && (
                <p className="text-xs text-red-600 mt-3">Payment is currently locked on this order. Please contact support.</p>
              )}
            </div>
            )}

            {shippedOrders.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-700 mb-3">Shipped Orders</h2>
                <div className="space-y-2">
                  {shippedOrders.map((pastOrder) => (
                    <details key={pastOrder.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium text-gray-700">
                        Order {getOrderRef(pastOrder.orderNumber, pastOrder.id)} • Shipped {new Date(pastOrder.updatedAt).toLocaleDateString()}
                      </summary>
                      <div className="mt-3 space-y-3 text-sm">
                        {pastOrder.trackingNumber && (
                          <div className="text-gray-600">Tracking: <span className="font-mono">{pastOrder.trackingNumber}</span></div>
                        )}
                        {pastOrder.prescriptionMeta && (
                          <div className="text-xs text-gray-600">
                            Refills remaining: <span className="font-semibold">{pastOrder.prescriptionMeta.refillsRemaining}</span> / {pastOrder.prescriptionMeta.refillsTotal}
                          </div>
                        )}
                        {pastOrder.prescriptionMeta && isPrescriptionExpired(pastOrder.prescriptionMeta) && (
                          <div className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 ring-1 ring-red-200">Refills are expired.</div>
                        )}
                        <button
                          className="btn-primary"
                          onClick={() => requestRefill(pastOrder.id)}
                          disabled={
                            requestingRefillFor === pastOrder.id ||
                            !pastOrder.prescriptionMeta ||
                            pastOrder.prescriptionMeta.refillsRemaining <= 0 ||
                            isPrescriptionExpired(pastOrder.prescriptionMeta)
                          }
                        >
                          {requestingRefillFor === pastOrder.id ? 'Requesting…' : 'Request Refill'}
                        </button>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {completedOrders.length > 0 && (
              <div className="card">
                <details>
                  <summary className="cursor-pointer font-semibold text-gray-700">Completed Orders ({completedOrders.length})</summary>
                  <div className="mt-3 space-y-2">
                    {completedOrders.map((pastOrder) => (
                      <div key={pastOrder.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-gray-700">Order {getOrderRef(pastOrder.orderNumber, pastOrder.id)}</span>
                          <span className="badge-green">Completed</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">Completed {new Date(pastOrder.updatedAt).toLocaleDateString()}</div>
                        {pastOrder.trackingNumber && (
                          <div className="mt-1 text-xs text-gray-600">Tracking: <span className="font-mono">{pastOrder.trackingNumber}</span></div>
                        )}
                        {pastOrder.prescriptionMeta && (
                          <div className="mt-1 text-xs text-gray-600">
                            Refills remaining: <span className="font-semibold">{pastOrder.prescriptionMeta.refillsRemaining}</span> / {pastOrder.prescriptionMeta.refillsTotal}
                          </div>
                        )}
                        {pastOrder.prescriptionMeta && isPrescriptionExpired(pastOrder.prescriptionMeta) && (
                          <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700 ring-1 ring-red-200">Refills are expired.</div>
                        )}
                        <button
                          className="btn-primary mt-3"
                          onClick={() => requestRefill(pastOrder.id)}
                          disabled={
                            requestingRefillFor === pastOrder.id ||
                            !pastOrder.prescriptionMeta ||
                            pastOrder.prescriptionMeta.refillsRemaining <= 0 ||
                            isPrescriptionExpired(pastOrder.prescriptionMeta)
                          }
                        >
                          {requestingRefillFor === pastOrder.id ? 'Requesting…' : 'Request Refill'}
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
