'use client'

import { useEffect, useState } from 'react'

type Medication = { id: string; name: string; description: string; directions: string; quantity: string; price: number; isActive: boolean; handoutUrl?: string | null }

const empty = { name: '', description: '', directions: '', quantity: '', price: '', handoutUrl: '' }

export default function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<Medication | null>(null)
  const [saving, setSaving] = useState(false)
  const [handoutFile, setHandoutFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const load = () => fetch('/api/medications').then(r => r.json()).then(setMeds)
  useEffect(() => { load() }, [])

  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    const payload = { ...form, price: parseFloat(form.price), handoutUrl: form.handoutUrl || null }
    if (editing) {
      await fetch(`/api/medications/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } else {
      await fetch('/api/medications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setForm(empty); setEditing(null); setSaving(false); load()
  }

  async function toggleActive(med: Medication) {
    await fetch(`/api/medications/${med.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !med.isActive }) })
    load()
  }

  function startEdit(med: Medication) {
    setEditing(med)
    setHandoutFile(null)
    setUploadError(null)
    setForm({ name: med.name, description: med.description, directions: med.directions, quantity: med.quantity, price: String(med.price), handoutUrl: med.handoutUrl ?? '' })
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Medications</h1>

      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <div className="col-span-1 card h-fit">
          <h2 className="font-semibold mb-4">{editing ? 'Edit Medication' : 'Add Medication'}</h2>
          <div className="space-y-3">
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={e => update('description', e.target.value)} /></div>
            <div><label className="label">Directions *</label><textarea className="input" rows={3} value={form.directions} onChange={e => update('directions', e.target.value)} placeholder="Inject 0.25mg subcutaneously once weekly…" /></div>
            <div><label className="label">Quantity *</label><input className="input" value={form.quantity} onChange={e => update('quantity', e.target.value)} placeholder="4 week supply (4 doses)" /></div>
            <div><label className="label">Price ($) *</label><input type="number" step="0.01" className="input" value={form.price} onChange={e => update('price', e.target.value)} /></div>
          </div>
          <div className="flex flex-col gap-3 mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button className="btn-primary w-full" onClick={save} disabled={saving || !form.name || !form.price}>
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Medication'}
              </button>
              {editing && <button className="btn-secondary w-full" onClick={() => { setEditing(null); setForm(empty); setHandoutFile(null) }}>Cancel</button>}
            </div>
            {editing && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <h3 className="font-semibold mb-2">Upload PDF handout</h3>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={e => setHandoutFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    className="btn-secondary"
                    type="button"
                    disabled={!handoutFile || uploading}
                    onClick={async () => {
                      if (!editing || !handoutFile) return
                      setUploading(true)
                      setUploadError(null)
                      const formData = new FormData()
                      formData.append('handout', handoutFile)

                      const res = await fetch(`/api/medications/${editing.id}/handout`, {
                        method: 'POST',
                        body: formData,
                      })

                      const raw = await res.text()
                      let data: { handoutUrl?: string; error?: string } = {}
                      try {
                        data = raw ? JSON.parse(raw) : {}
                      } catch (err) {
                        data = { error: raw || 'Unexpected response from upload endpoint.' }
                      }

                      if (res.ok && data.handoutUrl) {
                        setForm(f => ({ ...f, handoutUrl: data.handoutUrl }))
                        setEditing({ ...editing, handoutUrl: data.handoutUrl })
                        setHandoutFile(null)
                        setUploadError(null)
                        load()
                      } else {
                        setUploadError(data.error || `Upload failed with status ${res.status}`)
                      }
                      setUploading(false)
                    }}
                  >
                    {uploading ? 'Uploading…' : 'Upload PDF'}
                  </button>
                  {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
                  {editing.handoutUrl ? (
                    <a href={editing.handoutUrl} target="_blank" rel="noreferrer" className="text-sm text-brand-600 hover:underline">
                      Open current handout PDF
                    </a>
                  ) : (
                    <p className="text-xs text-gray-500">Save the medication first and then upload a PDF handout.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="col-span-2 space-y-3">
          {meds.map(med => (
            <div key={med.id} className={`card ${!med.isActive ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{med.name}</span>
                    <span className={med.isActive ? 'badge-green' : 'badge-gray'}>{med.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">{med.description}</div>
                  <div className="text-xs text-gray-400 mt-1">Qty: {med.quantity}</div>
                  <div className="text-xs text-gray-500 mt-1 bg-gray-50 rounded p-2">{med.directions}</div>
                  {med.handoutUrl && (
                    <div className="mt-3">
                      <a href={med.handoutUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border border-brand-600 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                        View Handout PDF
                      </a>
                    </div>
                  )}
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <div className="font-bold text-brand-700 text-xl">${med.price}</div>
                  <div className="flex gap-2 mt-2">
                    <button className="btn-secondary text-xs py-1 px-2" onClick={() => startEdit(med)}>Edit</button>
                    <button className="btn-secondary text-xs py-1 px-2" onClick={() => toggleActive(med)}>
                      {med.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {meds.length === 0 && <div className="card text-center text-gray-400 py-10">No medications yet.</div>}
        </div>
      </div>
    </div>
  )
}
