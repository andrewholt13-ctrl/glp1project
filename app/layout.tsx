import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Suspense } from 'react'
import { SessionProvider } from './providers'
import GlobalShell from '@/components/layout/GlobalShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GLP-1 Wellness Platform',
  description: 'Telehealth weight management program',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
            <GlobalShell>{children}</GlobalShell>
          </Suspense>
        </SessionProvider>
      </body>
    </html>
  )
}
