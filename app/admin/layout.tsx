'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

const NAV = [
  { href: '/admin', label: '🏠 Overview' },
  { href: '/admin/orders', label: '📋 Orders' },
  { href: '/admin/medications', label: '💊 Medications' },
  { href: '/admin/providers', label: '👩‍⚕️ Providers' },
  { href: '/admin/influencers', label: '📣 Influencers' },
  { href: '/admin/pharmacies', label: '🏥 Pharmacies' },
  { href: '/admin/support', label: '🛠️ Support' },
]

const MASTER_NAV = [
  { href: '/admin/users', label: '👥 Users' },
  { href: '/admin/audit', label: '🧾 Audit Log' },
  { href: '/admin/settings', label: '⚙️ Settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !['MASTER_ADMIN', 'ADMIN'].includes(session.user.role)) router.push('/login?error=Unauthorized')
  }, [status, session, router])

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-800">
          <div className="font-bold text-brand-400 text-lg">💊 GLP-1 Admin</div>
          <div className="text-xs text-gray-500 mt-0.5">Master Admin</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href ? 'bg-brand-700 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {session?.user.role === 'MASTER_ADMIN' && MASTER_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href ? 'bg-brand-700 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-left text-xs text-gray-500 hover:text-gray-300 px-3 py-2"
          >
            Sign Out →
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
