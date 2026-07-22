'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session.user.role !== 'PROVIDER') router.push('/login?error=Unauthorized')
  }, [status, session, router])

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-brand-700">💊 Provider Portal</span>
          <div className="flex items-center gap-4">
            <a href="/provider/support" className="text-sm font-medium text-brand-600 hover:text-brand-700">Support</a>
            <span className="text-sm text-gray-600">Dr. {session?.user.name}</span>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
