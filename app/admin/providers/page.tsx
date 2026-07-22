'use client'

import { useEffect, useState } from 'react'

type User = { id: string; name: string; email: string; phone: string; providerProfile: { npiNumber: string; licenseNumber: string; specialty: string; bio: string; isActive: boolean } }

const empty = { name: '', email: '', phone: '', password: '', npiNumber: '', licenseNumber: '', specialty: '', bio: '' }

export default function ProvidersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(empty)

  const load = () => fetch('/api/admin/users?role=PROVIDER').then(r => r.json()).then(setUsers)
  useEffect(() => { load() }, [])

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'PROVIDER',
        name: form.name, email: form.email, phone: form.phone, password: form.password,
        profile: { npiNumber: form.npiNumber, licenseNumber: form.licenseNumber, specialty: form.specialty, bio: form.bio },
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
      npiNumber: user.providerProfile?.npiNumber ?? '',
      licenseNumber: user.providerProfile?.licenseNumber ?? '',
      specialty: user.providerProfile?.specialty ?? '',
      bio: user.providerProfile?.bio ?? '',
    })
  }

  async function saveEdit(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'PROVIDER',
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        password: editForm.password || undefined,
        profile: {
          npiNumber: editForm.npiNumber,
          licenseNumber: editForm.licenseNumber,
          specialty: editForm.specialty,
          bio: editForm.bio,
          isActive: user.providerProfile?.isActive !== false,
        },
      }),
    })
    setEditingId(null)
    load()
  }

  async function toggleActive(user: User) {
    const nextActive = !(user.providerProfile?.isActive !== false)
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'PROVIDER',
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        profile: {
          npiNumber: user.providerProfile?.npiNumber ?? '',
          licenseNumber: user.providerProfile?.licenseNumber ?? '',
          specialty: user.providerProfile?.specialty ?? '',
          bio: user.providerProfile?.bio ?? '',
          isActive: nextActive,
        },
      }),
    })
    load()
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Providers</h1>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Provider</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">New Provider</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Full Name *</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} /></div>
            <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div><label className="label">Temp Password</label><input type="password" className="input" value={form.password} onChange={e => update('password', e.target.value)} placeholder="TempPass123!" /></div>
            <div><label className="label">NPI Number</label><input className="input" value={form.npiNumber} onChange={e => update('npiNumber', e.target.value)} /></div>
            <div><label className="label">License Number</label><input className="input" value={form.licenseNumber} onChange={e => update('licenseNumber', e.target.value)} /></div>
            <div><label className="label">Specialty</label><input className="input" value={form.specialty} onChange={e => update('specialty', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Bio</label><textarea className="input" rows={2} value={form.bio} onChange={e => update('bio', e.target.value)} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save} disabled={saving || !form.name || !form.email}>{saving ? 'Saving…' : 'Add Provider'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {users.map(u => (
          <div key={u.id} className="card">
            <div className="flex justify-between">
              <div>
                {editingId === u.id ? (
                  <div className="space-y-2">
                    <input className="input" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    <input className="input" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                    <input className="input" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                    <input className="input" type="password" placeholder="Set new password (optional)" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
                    <input className="input" placeholder="NPI" value={editForm.npiNumber} onChange={(e) => setEditForm((f) => ({ ...f, npiNumber: e.target.value }))} />
                    <input className="input" placeholder="License" value={editForm.licenseNumber} onChange={(e) => setEditForm((f) => ({ ...f, licenseNumber: e.target.value }))} />
                    <input className="input" placeholder="Specialty" value={editForm.specialty} onChange={(e) => setEditForm((f) => ({ ...f, specialty: e.target.value }))} />
                    <textarea className="input" rows={2} placeholder="Bio" value={editForm.bio} onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))} />
                  </div>
                ) : (
                  <>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-sm text-gray-500">{u.email} · {u.phone}</div>
                  </>
                )}
                {u.providerProfile && (
                  <div className="text-xs text-gray-400 mt-1 space-x-3">
                    <span>NPI: {u.providerProfile.npiNumber ?? '—'}</span>
                    <span>License: {u.providerProfile.licenseNumber ?? '—'}</span>
                    <span>Specialty: {u.providerProfile.specialty ?? '—'}</span>
                  </div>
                )}
                {u.providerProfile?.bio && <div className="text-xs text-gray-500 mt-1">{u.providerProfile.bio}</div>}
              </div>
              <div className="flex items-start gap-2">
                <span className={u.providerProfile?.isActive !== false ? 'badge-green h-fit' : 'badge-gray h-fit'}>
                  {u.providerProfile?.isActive !== false ? 'Active' : 'Inactive'}
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
                      {u.providerProfile?.isActive !== false ? 'Inactivate' : 'Activate'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="card text-center text-gray-400 py-10">No providers yet.</div>}
      </div>
    </div>
  )
}
