'use client'

import { useEffect, useState } from 'react'

type User = { id: string; name: string; email: string; phone: string; pharmacyProfile: { id: string; address: string; phone: string; licenseNum: string; isActive: boolean } }

const empty = { name: '', email: '', phone: '', password: '', address: '', licenseNum: '' }

export default function PharmaciesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(empty)
  const [defaultPharmacyId, setDefaultPharmacyId] = useState<string>('')

  const load = async () => {
    const [usersRes, settingsRes] = await Promise.all([
      fetch('/api/admin/users?role=PHARMACY'),
      fetch('/api/settings'),
    ])
    const usersData = await usersRes.json().catch(() => [])
    const settingsData = await settingsRes.json().catch(() => ({}))
    setUsers(Array.isArray(usersData) ? usersData : [])
    setDefaultPharmacyId(settingsData?.defaultPharmacyId ?? '')
  }
  useEffect(() => { load() }, [])

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'PHARMACY',
        name: form.name, email: form.email, phone: form.phone, password: form.password,
        profile: { address: form.address, phone: form.phone, licenseNum: form.licenseNum },
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
      address: user.pharmacyProfile?.address ?? '',
      licenseNum: user.pharmacyProfile?.licenseNum ?? '',
    })
  }

  async function saveEdit(user: User) {
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'PHARMACY',
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        password: editForm.password || undefined,
        profile: {
          address: editForm.address,
          phone: editForm.phone,
          licenseNum: editForm.licenseNum,
          isActive: user.pharmacyProfile?.isActive !== false,
        },
      }),
    })
    setEditingId(null)
    load()
  }

  async function toggleActive(user: User) {
    const nextActive = !(user.pharmacyProfile?.isActive !== false)
    await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'PHARMACY',
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        profile: {
          address: user.pharmacyProfile?.address ?? '',
          phone: user.pharmacyProfile?.phone ?? user.phone ?? '',
          licenseNum: user.pharmacyProfile?.licenseNum ?? '',
          isActive: nextActive,
        },
      }),
    })
    load()
  }

  async function setDefaultPharmacy(pharmacyId: string) {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultPharmacyId: pharmacyId }),
    })
    setDefaultPharmacyId(pharmacyId)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Pharmacies</h1>
        <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Add Pharmacy</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">New Pharmacy</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Pharmacy Name *</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} /></div>
            <div><label className="label">Login Email *</label><input type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
            <div><label className="label">Temp Password</label><input type="password" className="input" value={form.password} onChange={e => update('password', e.target.value)} /></div>
            <div className="col-span-2"><label className="label">Address</label><input className="input" value={form.address} onChange={e => update('address', e.target.value)} /></div>
            <div><label className="label">License Number</label><input className="input" value={form.licenseNum} onChange={e => update('licenseNum', e.target.value)} /></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={save} disabled={saving || !form.name || !form.email}>{saving ? 'Saving…' : 'Add Pharmacy'}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {users.map(u => (
          <div
            key={u.id}
            className={`card ${defaultPharmacyId === u.pharmacyProfile?.id ? 'ring-2 ring-emerald-400 bg-emerald-50/40' : ''}`}
          >
            <div className="flex justify-between">
              <div>
                {editingId === u.id ? (
                  <div className="space-y-2">
                    <input className="input" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    <input className="input" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                    <input className="input" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                    <input className="input" type="password" placeholder="Set new password (optional)" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
                    <input className="input" placeholder="Address" value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
                    <input className="input" placeholder="License Number" value={editForm.licenseNum} onChange={(e) => setEditForm((f) => ({ ...f, licenseNum: e.target.value }))} />
                  </div>
                ) : (
                  <>
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-sm text-gray-500">{u.email}</div>
                  </>
                )}
                {u.pharmacyProfile && (
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <div>Phone: {u.pharmacyProfile.phone ?? '—'}</div>
                    <div>Address: {u.pharmacyProfile.address ?? '—'}</div>
                    <div>License: {u.pharmacyProfile.licenseNum ?? '—'}</div>
                  </div>
                )}
              </div>
              <div className="flex items-start gap-2">
                <span className={u.pharmacyProfile?.isActive !== false ? 'badge-green' : 'badge-gray'}>
                  {u.pharmacyProfile?.isActive !== false ? 'Active' : 'Inactive'}
                </span>
                {defaultPharmacyId === u.pharmacyProfile?.id && (
                  <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white ring-2 ring-emerald-200">Default Pharmacy</span>
                )}
                {editingId === u.id ? (
                  <>
                    <button className="btn-primary text-xs" onClick={() => saveEdit(u)}>Save</button>
                    <button className="btn-secondary text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="btn-secondary text-xs" onClick={() => startEdit(u)}>Edit</button>
                    <button className="btn-secondary text-xs" onClick={() => toggleActive(u)}>
                      {u.pharmacyProfile?.isActive !== false ? 'Inactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => setDefaultPharmacy(u.pharmacyProfile?.id)}
                      disabled={defaultPharmacyId === u.pharmacyProfile?.id}
                    >
                      Set Default
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {users.length === 0 && <div className="card text-center text-gray-400 py-10">No pharmacies yet.</div>}
      </div>
    </div>
  )
}
