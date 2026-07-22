'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export default function SettingsPage() {
  const { data: session } = useSession()
  const [form, setForm] = useState({ outOfStateUrl: '', platformName: '', supportEmail: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setForm({
        outOfStateUrl: d.outOfStateUrl ?? '',
        platformName: d.platformName ?? '',
        supportEmail: d.supportEmail ?? '',
      })
    })
  }, [])

  async function save() {
    if (session?.user.role !== 'MASTER_ADMIN') {
      alert('Only Master Admin can edit platform settings.')
      return
    }
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Platform Settings</h1>
      {session?.user.role !== 'MASTER_ADMIN' && (
        <div className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
          Read-only view: platform settings are restricted to Master Admin.
        </div>
      )}
      <div className="card space-y-4">
        <div>
          <label className="label">Platform Name</label>
          <input className="input" value={form.platformName} onChange={e => update('platformName', e.target.value)} />
        </div>
        <div>
          <label className="label">Support Email</label>
          <input type="email" className="input" value={form.supportEmail} onChange={e => update('supportEmail', e.target.value)} />
        </div>
        <div>
          <label className="label">Out-of-State Redirect URL</label>
          <input className="input" value={form.outOfStateUrl} onChange={e => update('outOfStateUrl', e.target.value)} placeholder="https://partner.com/program" />
          <p className="text-xs text-gray-400 mt-1">Patients outside Georgia are sent to this URL. Change it here anytime.</p>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving || session?.user.role !== 'MASTER_ADMIN'}>
          {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
