'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

type Order = {
  id: string; status: string; createdAt: string
  amountPaid: number | null; commissionPaid: number | null
  medication: { name: string; price: number } | null
  patient: { user: { name: string } }
}

export default function InfluencerDashboard() {
  const { data: session } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [code, setCode] = useState('')

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(setOrders)
    fetch('/api/influencer/profile').then(r => r.json()).then(d => { if (d.code) setCode(d.code) })
  }, [])

  const completed = orders.filter(o => o.status === 'COMPLETED')
  const totalEarned = orders.reduce((s, o) => s + (o.commissionPaid ?? 0), 0)
  const pendingEarned = orders.filter(o => o.status !== 'COMPLETED' && o.amountPaid != null).length
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const BADGE: Record<string, string> = {
    INTAKE_PENDING:'badge-yellow',PROVIDER_REVIEW:'badge-blue',PRESCRIBED:'badge-blue',
    PHARMACY_PENDING:'badge-yellow',SHIPPED:'badge-green',COMPLETED:'badge-green',CANCELLED:'badge-red',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-brand-700">{orders.length}</div>
          <div className="text-sm text-gray-500 mt-1">Total Referrals</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-brand-700">{completed.length}</div>
          <div className="text-sm text-gray-500 mt-1">Completed Scripts</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-brand-700">${totalEarned.toFixed(2)}</div>
          <div className="text-sm text-gray-500 mt-1">Total Earned</div>
        </div>
      </div>

      {/* Referral link */}
      {code && (
        <div className="card">
          <h2 className="font-semibold mb-3">Your Referral Link</h2>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono text-sm bg-gray-50"
              value={`${baseUrl}/?ref=${code}`}
              readOnly
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              className="btn-secondary flex-shrink-0"
              onClick={() => navigator.clipboard.writeText(`${baseUrl}/?ref=${code}`)}
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Share this link or use QR code below. Every patient who signs up through your link is tracked to you.</p>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-center">
            <div className="text-xs text-gray-400 mb-1">Your code</div>
            <div className="text-2xl font-mono font-bold text-brand-700">{code}</div>
            <div className="text-xs text-gray-400 mt-1">Also works at checkout as a referral code</div>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="card">
        <h2 className="font-semibold mb-4">All Referrals</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase text-left">
              <th className="pb-2 pr-4">Patient</th>
              <th className="pb-2 pr-4">Medication</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Commission</th>
              <th className="pb-2">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map(o => (
              <tr key={o.id}>
                <td className="py-2 pr-4 font-medium">{o.patient?.user?.name}</td>
                <td className="py-2 pr-4 text-gray-500">{o.medication?.name ?? '—'}</td>
                <td className="py-2 pr-4"><span className={BADGE[o.status] ?? 'badge-gray'}>{o.status.replace(/_/g,' ')}</span></td>
                <td className="py-2 pr-4">
                  {o.status === 'COMPLETED'
                    ? <span className="badge-green">${(o.commissionPaid ?? 0).toFixed(2)} earned</span>
                    : <span className="badge-gray">Pending</span>
                  }
                </td>
                <td className="py-2 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400">No referrals yet — share your link to get started!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
