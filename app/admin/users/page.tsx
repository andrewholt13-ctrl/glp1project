'use client'

import { useEffect, useMemo, useState } from 'react'

type Role = 'PATIENT' | 'PROVIDER' | 'PHARMACY'

type UserRecord = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  mustResetPassword?: boolean
  createdAt: string
  providerProfile?: { npiNumber: string | null; licenseNumber: string | null; specialty: string | null; bio: string | null } | null
  pharmacyProfile?: { address: string | null; phone: string | null; licenseNum: string | null } | null
  patientProfile?: { dateOfBirth: string | null; address: string | null; city: string | null; state: string | null; zip: string | null } | null
}

const emptyForm = {
  role: 'PATIENT' as Role,
  name: '',
  email: '',
  phone: '',
  password: '',
  npiNumber: '',
  licenseNumber: '',
  specialty: '',
  bio: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  dateOfBirth: '',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const load = async () => {
    const res = await fetch('/api/admin/users')
    const text = await res.text()
    let data: unknown = []
    try {
      data = text ? JSON.parse(text) : []
    } catch {
      data = []
    }
    if (!res.ok) {
      alert((data as { error?: string })?.error ?? 'Could not load users.')
      setUsers([])
      return
    }
    setUsers(Array.isArray(data) ? (data as UserRecord[]) : [])
  }

  useEffect(() => {
    load()
  }, [])

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((user) => [user.name, user.email, user.phone ?? '', user.role].join(' ').toLowerCase().includes(q))
  }, [query, users])

  const updateForm = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const updateEditForm = (key: string, value: string) => setEditForm((current) => ({ ...current, [key]: value }))

  function buildProfilePayload(base: typeof emptyForm) {
    if (base.role === 'PROVIDER') {
      return {
        npiNumber: base.npiNumber || null,
        licenseNumber: base.licenseNumber || null,
        specialty: base.specialty || null,
        bio: base.bio || null,
      }
    }
    if (base.role === 'PHARMACY') {
      return {
        address: base.address || null,
        phone: base.phone || null,
        licenseNum: base.licenseNumber || null,
      }
    }
    return {
      dateOfBirth: base.dateOfBirth || null,
      address: base.address || null,
      city: base.city || null,
      state: base.state || null,
      zip: base.zip || null,
    }
  }

  async function createUser() {
    if (!form.name || !form.email) {
      alert('Name and email are required.')
      return
    }

    setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: form.role,
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password || null,
        profile: buildProfilePayload(form),
      }),
    })
    const text = await res.text()
    let data: { error?: string } | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!res.ok) {
      alert(data?.error ?? text ?? 'Could not create user.')
      setSaving(false)
      return
    }

    setForm(emptyForm)
    setSaving(false)
    load()
  }

  function startEdit(user: UserRecord) {
    setEditing(user)
    setEditForm({
      role: (['PATIENT', 'PROVIDER', 'PHARMACY'].includes(user.role) ? user.role : 'PATIENT') as Role,
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      password: '',
      npiNumber: user.providerProfile?.npiNumber ?? '',
      licenseNumber: user.providerProfile?.licenseNumber ?? user.pharmacyProfile?.licenseNum ?? '',
      specialty: user.providerProfile?.specialty ?? '',
      bio: user.providerProfile?.bio ?? '',
      address: user.pharmacyProfile?.address ?? user.patientProfile?.address ?? '',
      city: user.patientProfile?.city ?? '',
      state: user.patientProfile?.state ?? '',
      zip: user.patientProfile?.zip ?? '',
      dateOfBirth: user.patientProfile?.dateOfBirth ?? '',
    })
  }

  async function saveEdit() {
    if (!editing) return
    const res = await fetch(`/api/admin/users/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: editForm.role,
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone || null,
        password: editForm.password || undefined,
        profile: buildProfilePayload(editForm),
      }),
    })
    const text = await res.text()
    let data: { error?: string } | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!res.ok) {
      alert(data?.error ?? text ?? 'Could not update user.')
      return
    }
    setEditing(null)
    load()
  }

  async function deleteUser(userId: string) {
    if (!confirm('Delete this user account? This action cannot be undone.')) return

    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    const text = await res.text()
    let data: { error?: string } | null = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    if (!res.ok) {
      alert(data?.error ?? text ?? 'Could not delete user.')
      return
    }

    if (editing?.id === userId) setEditing(null)
    load()
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-sm text-gray-500">Master admin can add, edit, and delete patient, provider, and pharmacy accounts.</p>
      </div>

      <div className="card space-y-4">
        <h2 className="font-semibold">Create Account</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={(e) => updateForm('role', e.target.value)}>
              <option value="PATIENT">Patient</option>
              <option value="PROVIDER">Doctor / Provider</option>
              <option value="PHARMACY">Pharmacy</option>
            </select>
          </div>
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
          </div>
          <div>
            <label className="label">Email / Username</label>
            <input className="input" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} />
          </div>
          <div>
            <label className="label">Temporary Password</label>
            <input className="input" type="password" value={form.password} onChange={(e) => updateForm('password', e.target.value)} placeholder="TempPass123!" />
          </div>

          {form.role === 'PROVIDER' && (
            <>
              <div><label className="label">NPI Number</label><input className="input" value={form.npiNumber} onChange={(e) => updateForm('npiNumber', e.target.value)} /></div>
              <div><label className="label">License Number</label><input className="input" value={form.licenseNumber} onChange={(e) => updateForm('licenseNumber', e.target.value)} /></div>
              <div><label className="label">Specialty</label><input className="input" value={form.specialty} onChange={(e) => updateForm('specialty', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Bio</label><textarea className="input" rows={2} value={form.bio} onChange={(e) => updateForm('bio', e.target.value)} /></div>
            </>
          )}

          {form.role === 'PHARMACY' && (
            <>
              <div className="col-span-2"><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => updateForm('address', e.target.value)} /></div>
              <div><label className="label">License Number</label><input className="input" value={form.licenseNumber} onChange={(e) => updateForm('licenseNumber', e.target.value)} /></div>
            </>
          )}

          {form.role === 'PATIENT' && (
            <>
              <div><label className="label">Date Of Birth</label><input className="input" type="date" value={form.dateOfBirth} onChange={(e) => updateForm('dateOfBirth', e.target.value)} /></div>
              <div><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => updateForm('address', e.target.value)} /></div>
              <div><label className="label">City</label><input className="input" value={form.city} onChange={(e) => updateForm('city', e.target.value)} /></div>
              <div><label className="label">State</label><input className="input" value={form.state} onChange={(e) => updateForm('state', e.target.value)} /></div>
              <div><label className="label">ZIP</label><input className="input" value={form.zip} onChange={(e) => updateForm('zip', e.target.value)} /></div>
            </>
          )}
        </div>

        <div>
          <button className="btn-primary" onClick={createUser} disabled={saving}>{saving ? 'Creating…' : 'Create Account'}</button>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">All Users</h2>
          <input className="input max-w-sm" placeholder="Search name, email, phone, role" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div key={user.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-sm text-gray-600">{user.email}</div>
                  <div className="text-xs text-gray-500 mt-1">Role: {user.role} · Phone: {user.phone ?? '—'}</div>
                  {user.mustResetPassword && <div className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Password reset required on next login</div>}
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary text-xs" onClick={() => startEdit(user)}>Edit</button>
                  <button className="btn-secondary text-xs" onClick={() => deleteUser(user.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && <div className="text-sm text-gray-500">No users found.</div>}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl space-y-4">
            <h3 className="text-lg font-semibold">Edit User</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Role</label>
                <select className="input" value={editForm.role} onChange={(e) => updateEditForm('role', e.target.value)}>
                  <option value="PATIENT">Patient</option>
                  <option value="PROVIDER">Doctor / Provider</option>
                  <option value="PHARMACY">Pharmacy</option>
                </select>
              </div>
              <div><label className="label">Name</label><input className="input" value={editForm.name} onChange={(e) => updateEditForm('name', e.target.value)} /></div>
              <div><label className="label">Email / Username</label><input className="input" value={editForm.email} onChange={(e) => updateEditForm('email', e.target.value)} /></div>
              <div><label className="label">Phone</label><input className="input" value={editForm.phone} onChange={(e) => updateEditForm('phone', e.target.value)} /></div>
              <div><label className="label">Set New Password</label><input className="input" type="password" value={editForm.password} onChange={(e) => updateEditForm('password', e.target.value)} placeholder="Leave blank to keep current" /></div>

              {editForm.role === 'PROVIDER' && (
                <>
                  <div><label className="label">NPI Number</label><input className="input" value={editForm.npiNumber} onChange={(e) => updateEditForm('npiNumber', e.target.value)} /></div>
                  <div><label className="label">License Number</label><input className="input" value={editForm.licenseNumber} onChange={(e) => updateEditForm('licenseNumber', e.target.value)} /></div>
                  <div><label className="label">Specialty</label><input className="input" value={editForm.specialty} onChange={(e) => updateEditForm('specialty', e.target.value)} /></div>
                  <div className="col-span-2"><label className="label">Bio</label><textarea className="input" rows={2} value={editForm.bio} onChange={(e) => updateEditForm('bio', e.target.value)} /></div>
                </>
              )}

              {editForm.role === 'PHARMACY' && (
                <>
                  <div className="col-span-2"><label className="label">Address</label><input className="input" value={editForm.address} onChange={(e) => updateEditForm('address', e.target.value)} /></div>
                  <div><label className="label">License Number</label><input className="input" value={editForm.licenseNumber} onChange={(e) => updateEditForm('licenseNumber', e.target.value)} /></div>
                </>
              )}

              {editForm.role === 'PATIENT' && (
                <>
                  <div><label className="label">Date Of Birth</label><input className="input" type="date" value={editForm.dateOfBirth} onChange={(e) => updateEditForm('dateOfBirth', e.target.value)} /></div>
                  <div><label className="label">Address</label><input className="input" value={editForm.address} onChange={(e) => updateEditForm('address', e.target.value)} /></div>
                  <div><label className="label">City</label><input className="input" value={editForm.city} onChange={(e) => updateEditForm('city', e.target.value)} /></div>
                  <div><label className="label">State</label><input className="input" value={editForm.state} onChange={(e) => updateEditForm('state', e.target.value)} /></div>
                  <div><label className="label">ZIP</label><input className="input" value={editForm.zip} onChange={(e) => updateEditForm('zip', e.target.value)} /></div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button className="btn-primary" onClick={saveEdit}>Save Changes</button>
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
