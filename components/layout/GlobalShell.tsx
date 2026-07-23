"use client"

import { useRouter, usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

export default function GlobalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const hideShellHeader = pathname.startsWith('/admin') || pathname.startsWith('/provider') || pathname.startsWith('/pharmacy') || pathname.startsWith('/influencer')
  const hideBackButton = pathname === '/' || pathname === '/login'
  const hideLogoutButton = pathname === '/' || pathname === '/login'

  return (
    <div className="min-h-screen bg-stone-50">
      {!hideShellHeader && (
        <header className="sticky top-0 z-20 border-b border-brand-100 bg-white/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!hideBackButton && (
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50"
              >
                ← Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-stone-600 sm:inline">{session?.user?.name ?? 'Guest'}</span>
            <a
              href="/support"
              className="inline-flex items-center rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              Customer Support
            </a>
            {!hideLogoutButton && (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="inline-flex items-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Log out
              </button>
            )}
          </div>
        </div>
      </header>
    )}

      <div className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </div>
    </div>
  )
}
