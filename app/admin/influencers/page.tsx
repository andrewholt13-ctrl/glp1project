'use client'

import { useEffect, useState } from 'react'

type User = { id: string; name: string; email: string; phone: string; influencerProfile: { code: string; commissionRate: number; isActive: boolean } }

const empty = { name: '', email: '', phone: '', password: '', code: '', commissionRate: '0' }

export default function InfluencersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(empty)

  const load = () => fetch('/api/admin/users?role=INFLUENCER').then(r => r.json()).then(setUsers)
  useEffect(() => { load() }, [])

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'INFLUENCER',
        name: form.name, email: form.email, phone: form.phone, password: form.password,
        profile: { code: form.code.toUpperCase(), commissionRate: parseFloat(form.commissionRate) },
      }),
    })
    setForm(empty); setSaving(false); setShowForm(false); load()
  }

  function startEdit(user: User) {
    setEditingId(user.id)
    setEditForm({
      name: user.name ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      password: '',
      code: user.influencerProfile?.code ?? '',
      commissionRate: String(user.influencerProfile?.commissionRate ?? 0),
    })
  }

  async function saveEdit(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'INFLUENCER',
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        password: editForm.password || undefined,
        profile: {
          code: editForm.code.toUpperCase(),
          commissionRate: parseFloat(editForm.commissionRate || '0'),
          isActive: user.influencerProfile?.isActive !== false,
        },
      }),
    })
    setEditingId(null)
    load()
  }

  async function toggleActive(user: User) {
    const nextActive = !(user.influencerProfile?.isActive !== false)
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'INFLUENCER',
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        profile: {
          code: user.influencerProfile?.code ?? '',
          commissionRate: Number(user.influencerProfile?.commissionRate ?? 0),
          isActive: nextActive,
        },
      }),
    })
    load()
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Influencers</h1>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Influencer</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">New Influencer</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Full Name *</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} /></div>
            <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div><label className="label">Temp Password</label><input type="password" className="input" value={form.password} onChange={e => update('password', e.target.value)} /></div>
            <div>
              <label className="label">Referral Code *</label>
              <input className="input uppercase" value={form.code} onChange={e => update('code', e.target.value.toUpperCase())} placeholder="JOSMITH" />
            </div>
            <div>
              <label className="label">Commission per Completed Script ($)</label>
              <input type="number" step="0.01" className="input" value={form.commissionRate} onChange={e => update('commissionRate', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save} disabled={saving || !form.name || !form.email || !form.code}>{saving ? 'Saving…' : 'Add Influencer'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {users.map(u => {
          const link = u.influencerProfile ? `${baseUrl}/?ref=${u.influencerProfile.code}` : ''
          return (
            <div key={u.id} className="card">
              <div className="flex justify-between items-start">
                <div>
                  {editingId === u.id ? (
                    <div className="space-y-2">
                      <input className="input" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                      <input className="input" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                      <input className="input" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                      <input className="input" type="password" placeholder="Set new password (optional)" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
                      <input className="input uppercase" placeholder="Referral Code" value={editForm.code} onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
                      <input className="input" type="number" step="0.01" placeholder="Commission" value={editForm.commissionRate} onChange={(e) => setEditForm((f) => ({ ...f, commissionRate: e.target.value }))} />
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-sm text-gray-500">{u.email} · {u.phone}</div>
                    </>
                  )}
                  {u.influencerProfile && (
                    <div className="mt-2 space-y-1">
                      <div className="text-xs">
                        <span className="text-gray-400">Code: </span>
                        <span className="font-mono font-bold text-brand-700">{u.influencerProfile.code}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-400">Commission: </span>
                        <span className="font-medium">${u.influencerProfile.commissionRate}/completed script</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Referral link: <span className="font-mono text-brand-600 text-xs break-all">{link}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <span className={u.influencerProfile?.isActive !== false ? 'badge-green h-fit' : 'badge-gray h-fit'}>
                    {u.influencerProfile?.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                  {editingId === u.id ? (
                    <>
                      <button className="btn-primary text-xs" onClick={() => saveEdit(u)}>Save</button>
                      <button className="btn-secondary text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-secondary text-xs" onClick={() => startEdit(u)}>Edit</button>
                      <button className="btn-secondary text-xs" onClick={() => toggleActive(u)}>
                        {u.influencerProfile?.isActive !== false ? 'Inactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {users.length === 0 && <div className="card text-center text-gray-400 py-10">No influencers yet.</div>}
      </div>
    </div>
  )
}
