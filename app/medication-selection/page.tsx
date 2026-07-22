'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Medication = {
  id: string
  name: string
  description: string | null
  quantity: string | null
  price: number
}

export default function MedicationSelectionPage() {
  const router = useRouter()
  const [medications, setMedications] = useState<Medication[]>([])
  const [selectedMeds, setSelectedMeds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/medications?active=true')
      .then((r) => r.json())
      .then(setMedications)
      .catch(() => setMedications([]))
  }, [])

  async function submit() {
    if (selectedMeds.length === 0) {
      alert('Select at least one medication.')
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/patients/orders/reselect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ medicationIds: selectedMeds }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      alert(data?.error ?? 'Could not submit medication selection.')
      setSubmitting(false)
      return
    }

    router.push('/status')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-bold text-brand-700">💊 GLP-1 Wellness</a>
          <span className="text-sm text-gray-500">Medication Selection</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="card">
          <h1 className="text-xl font-bold mb-2">Select Medications for Provider Review</h1>
          <p className="text-sm text-gray-500 mb-5">
            Your previous order was voided. Please reselect up to 2 medications and send your request to the provider.
          </p>

          <div className="space-y-3">
            <div className="mb-3 text-sm text-gray-600">{selectedMeds.length}/2 selected</div>
            {medications.map((med) => (
              <label
                key={med.id}
                className={`block cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                  selectedMeds.includes(med.id) ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedMeds.includes(med.id)}
                  onChange={() => {
                    setSelectedMeds((current) => {
                      if (current.includes(med.id)) return current.filter((id) => id !== med.id)
                      if (current.length >= 2) {
                        alert('You can select up to 2 medications.')
                        return current
                      }
                      return [...current, med.id]
                    })
                  }}
                  className="sr-only"
                />
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">{med.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{med.description ?? ''}</div>
                    <div className="text-xs text-gray-400 mt-1">Qty: {med.quantity ?? 'N/A'}</div>
                  </div>
                  <div className="text-right ml-4 flex-shrink-0">
                    <div className="font-bold text-brand-700 text-lg">${med.price}</div>
                    <div className="text-xs text-gray-400">one-time</div>
                  </div>
                </div>
              </label>
            ))}
          </div>

          <button className="btn-primary mt-6 w-full" onClick={submit} disabled={submitting || selectedMeds.length === 0}>
            {submitting ? 'Submitting…' : 'Submit Preferences To Provider'}
          </button>
        </div>
      </main>
    </div>
  )
}
