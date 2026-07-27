'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getOrderRef } from '@/lib/orderRef'

type OrderSummary = {
  id: string
  orderNumber: string | null
  medication: { name: string; price: number; directions: string } | null
  orderMedications?: Array<{ id: string; medication: { name: string; price: number; directions: string; quantity?: string } }>
  patient?: { user?: { name?: string; email?: string } }
  status: string
  paymentState: 'UNPAID' | 'PAID' | 'REFUNDED' | 'VOIDED'
}

export default function PaymentPage() {
  const router = useRouter()
  const params = useSearchParams()
  const orderId = params.get('orderId') ?? ''
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/patients/orders')
      .then(async (r) => {
        const text = await r.text()
        const data = text ? JSON.parse(text) : []
        if (!r.ok) throw new Error('Could not load orders')
        return Array.isArray(data) ? data as OrderSummary[] : []
      })
      .then((allOrders) => {
        const payable = allOrders.filter((o) => o.status === 'PRESCRIBED' && o.paymentState === 'UNPAID')
        setOrders(payable)

        if (payable.length === 0) {
          setSelectedOrderIds([])
          return
        }

        const initial = orderId && payable.some((o) => o.id === orderId)
          ? [orderId]
          : [payable[0].id]
        setSelectedOrderIds(initial)
      })
      .catch(() => setError('Could not load order.'))
      .finally(() => setLoadingOrders(false))
  }, [orderId])

  function toggleSelectedOrder(id: string) {
    setSelectedOrderIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      return [...current, id]
    })
  }

  async function handleCheckout() {
    if (selectedOrderIds.length === 0) {
      setError('Select at least one order to pay.')
      return
    }
    setLoading(true)
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: selectedOrderIds }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setError(data.error ?? 'Payment failed to initialize.')
      setLoading(false)
    }
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="card text-center max-w-sm">
        <p className="text-red-600 font-medium">{error}</p>
        <a href="/" className="btn-primary mt-4 inline-block">Start Over</a>
      </div>
    </div>
  )

  if (loadingOrders) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-gray-500">Loading order…</div>
    </div>
  )

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card max-w-xl w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Payment Not Ready Yet</h1>
          <p className="text-gray-500 mb-4">
            You do not have any open prescribed orders that are ready for payment.
          </p>
          <a href="/status" className="btn-primary inline-block">Go To Patient Portal →</a>
        </div>
      </div>
    )
  }

  const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id))
  const primaryOrder = selectedOrders[0]
  if (!primaryOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="card max-w-xl w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Select Orders To Pay</h1>
          <p className="text-gray-500 mb-4">
            Choose at least one order to continue to secure checkout.
          </p>
          <a href="/status" className="btn-primary inline-block">Go To Patient Portal →</a>
        </div>
      </div>
    )
  }

  const selectedMedications = selectedOrders.flatMap((order) => {
    const meds = order.orderMedications ?? []
    if (meds.length > 0) {
      return meds.map((item) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        name: item.medication.name,
        directions: item.medication.directions,
        price: item.medication.price,
      }))
    }

    return order.medication
      ? [{
          orderId: order.id,
          orderNumber: order.orderNumber,
          name: order.medication.name,
          directions: order.medication.directions,
          price: order.medication.price,
        }]
      : []
  })

  const totalDue = selectedMedications.reduce((sum, med) => sum + med.price, 0)
  const patientName = selectedOrders.find((item) => item.patient?.user?.name)?.patient?.user?.name ?? 'Patient'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-brand-700">💊 Butter Health</span>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Ready To Pay</h1>

        <button
          onClick={() => router.back()}
          className="btn-secondary w-full mb-4"
        >
          ← Back to patient portal
        </button>

        <div className="card mb-4">
          {orders.length > 1 && (
            <>
              <h2 className="font-semibold text-gray-700 mb-3">Select Orders To Pay</h2>
              <p className="text-sm text-gray-500 mb-3">Check all open orders you want to pay for now.</p>
              <div className="space-y-2 mb-4">
                {orders.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(item.id)}
                      onChange={() => toggleSelectedOrder(item.id)}
                    />
                    <span className="font-medium">Order {getOrderRef(item.orderNumber, item.id)}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <h2 className="font-semibold text-gray-700 mb-3">Order Summary</h2>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Patient</span>
              <span className="font-medium">{patientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Orders selected</span>
              <span className="font-medium">{selectedOrders.length}</span>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
              Your provider selected the final medications below. Payment is required before pharmacy shipping can begin.
            </div>
            {selectedMedications.map((med, index) => (
              <div key={`${med.orderId}-${med.name}-${index}`} className="rounded-lg border border-gray-100 p-3 bg-white">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="font-medium text-gray-900">{med.name}</div>
                    <div className="text-xs text-gray-500 mt-1">Order {getOrderRef(med.orderNumber, med.orderId)}</div>
                    <div className="text-xs text-gray-500 mt-1">{med.directions}</div>
                  </div>
                  <div className="text-right text-sm font-semibold text-brand-700">${med.price.toFixed(2)}</div>
                </div>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base">
              <span>Total Due</span>
              <span className="text-brand-700">${totalDue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="card mb-4 bg-blue-50 ring-1 ring-blue-200">
          <p className="text-sm text-blue-800">
            <strong>One-time payment.</strong> This covers your provider consultation, prescription, and medication for the listed supply period. No hidden fees or subscriptions.
          </p>
        </div>

        <button
          onClick={handleCheckout}
          disabled={loading || selectedOrderIds.length === 0}
          className="btn-primary w-full text-base py-3"
        >
          {loading ? 'Redirecting to Stripe…' : `Pay $${totalDue.toFixed(2)} Securely →`}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          Payments are processed securely via Stripe. We do not store your card information.
        </p>
      </main>
    </div>
  )
}
