'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Stats = { total: number; pending: number; prescribed: number; shipped: number; completed: number; revenue: number }

export default function AdminOverview() {
  const [orders, setOrders] = useState<any[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, prescribed: 0, shipped: 0, completed: 0, revenue: 0 })

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then((data: any[]) => {
      setOrders(data)
      setStats({
        total: data.length,
        pending: data.filter(o => ['INTAKE_PENDING', 'PROVIDER_REVIEW'].includes(o.status)).length,
        prescribed: data.filter(o => o.status === 'PRESCRIBED').length,
        shipped: data.filter(o => o.status === 'SHIPPED').length,
        completed: data.filter(o => o.status === 'COMPLETED').length,
        revenue: data.reduce((sum, o) => sum + (o.amountPaid ?? 0), 0),
      })
    })
  }, [])

  const STATUS_BADGE: Record<string, string> = {
    INTAKE_PENDING: 'badge-yellow', PROVIDER_REVIEW: 'badge-blue',
    PRESCRIBED: 'badge-blue', PHARMACY_PENDING: 'badge-yellow',
    SHIPPED: 'badge-green', COMPLETED: 'badge-green', CANCELLED: 'badge-red',
  }
  const STATUS_LABEL: Record<string, string> = {
    INTAKE_PENDING: 'Intake', PROVIDER_REVIEW: 'Review',
    PRESCRIBED: 'Prescribed', PHARMACY_PENDING: 'Pharmacy',
    SHIPPED: 'Shipped', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/orders?addOrder=1" className="btn-primary">+ Add Order</Link>
        <h1 className="text-2xl font-bold">Overview</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Orders', value: stats.total },
          { label: 'Pending', value: stats.pending },
          { label: 'Prescribed', value: stats.prescribed },
          { label: 'Shipped', value: stats.shipped },
          { label: 'Completed', value: stats.completed },
          { label: 'Total Revenue', value: `$${stats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-4">All Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                <th className="pb-2 pr-4">Patient</th>
                <th className="pb-2 pr-4">Medication</th>
                <th className="pb-2 pr-4">Provider</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Paid</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{o.patient?.user?.name}</div>
                    <div className="text-xs text-gray-400">{o.patient?.user?.email}</div>
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{o.medication?.name ?? '—'}</td>
                  <td className="py-2 pr-4 text-gray-600">{o.provider?.user?.name ?? 'Unassigned'}</td>
                  <td className="py-2 pr-4">
                    <span className={STATUS_BADGE[o.status] ?? 'badge-gray'}>{STATUS_LABEL[o.status] ?? o.status}</span>
                  </td>
                  <td className="py-2 pr-4">{o.amountPaid != null ? `$${o.amountPaid.toFixed(2)}` : '—'}</td>
                  <td className="py-2 text-gray-400 text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
