'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Medication = { id: string; name: string; description: string; directions: string; quantity: string; price: number }
type ProviderOption = { id: string; specialty: string | null; isActive?: boolean; user: { name: string } }
type PharmacyOption = { id: string; address: string | null; phone: string | null; isDefault: boolean; isActive?: boolean; user: { name: string } }

export default function IntakePage() {
  const router = useRouter()
  const params = useSearchParams()
  const state = params.get('state') ?? 'Georgia'
  const ref = params.get('ref') ?? ''

  const [step, setStep] = useState(1)
  const [medications, setMedications] = useState<Medication[]>([])
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('')
  const [selectedMeds, setSelectedMeds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [pcpSeen, setPcpSeen] = useState<boolean | null>(null)
  const [heartConditions, setHeartConditions] = useState<string[]>([])
  const [endocrineConditions, setEndocrineConditions] = useState<string[]>([])
  const [otherHeart, setOtherHeart] = useState('')
  const [showOtherHeart, setShowOtherHeart] = useState(false)
  const [otherEndocrine, setOtherEndocrine] = useState('')
  const [showOtherEndocrine, setShowOtherEndocrine] = useState(false)
  const heartOptions = [
    'Afib', 'Tachycardia', 'Heart failure', 'Stroke / other heart disease', 'Prolonged QT interval', 'Other rhythm/ECG issues', 'Hypertension (High blood pressure)', 'Hyperlipidemia (High cholesterol)', 'Hypertriglyceridemia (High triglycerides)', 'No, I have not been diagnosed with a heart condition'
  ]
  const endocrineOptions = [
    'Multiple Endocrine Neoplasia syndrome type 2', 'Chronic kidney disease', 'Fatty liver disease', 'Kidney stones', 'Liver cirrhosis or end stage liver disease', 'Hypothyroidism', 'Hyperthyroidism', 'Graves disease', 'Syndrome of inappropriate antidiuretic hormone (SIADH)', 'Other', 'No, I have not been diagnosed with any of these conditions'
  ]
  const [cancerHistory, setCancerHistory] = useState<string | null>(null)
  const cancerOptions = ['Yes, I have been diagnosed with cancer', 'Yes, a family member has cancer', 'No, neither']

  const [diabetesStatus, setDiabetesStatus] = useState<string | null>(null)
  const diabetesOptions = ['Diabetes requiring insulin', 'Diabetes not requiring insulin', 'Prediabetes', 'None of these']

  const [giConditions, setGiConditions] = useState<string[]>([])
  const [otherGi, setOtherGi] = useState('')
  const [showOtherGi, setShowOtherGi] = useState(false)
  const giOptions = ['Bariatric surgery', 'Pancreatitis', 'Delayed gastric emptying / gastroparesis', 'Gallstones / gallbladder disease', 'GERD / acid reflux', 'No history of these']
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
    address: '', city: '', zip: '',
    weight: '', height: '', allergies: '', currentMeds: '', medicalHistory: '',
    password: '',
  })

  useEffect(() => {
    fetch('/api/medications?active=true').then(r => r.json()).then(setMedications)
    fetch('/api/providers').then(r => r.json()).then((list) => {
      const items = (Array.isArray(list) ? list : []).filter((item: ProviderOption) => item.isActive !== false)
      setProviders(items)
      if (items[0]?.id) setSelectedProviderId(items[0].id)
    }).catch(() => setProviders([]))
    fetch('/api/pharmacies').then(r => r.json()).then((list) => {
      const items = (Array.isArray(list) ? list : []).filter((item: PharmacyOption) => item.isActive !== false)
      setPharmacies(items)
      const defaultPharmacy = items.find((item: PharmacyOption) => item.isDefault)
      if (defaultPharmacy?.id) setSelectedPharmacyId(defaultPharmacy.id)
      else if (items[0]?.id) setSelectedPharmacyId(items[0].id)
    }).catch(() => setPharmacies([]))
  }, [])

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  async function handleSubmit() {
    try {
      setSubmitting(true)
      const res = await fetch('/api/patients/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          state,
          medicationIds: selectedMeds,
          referralCode: ref,
          pcpSeen,
          heartConditions,
          endocrineConditions,
          cancerHistory,
          diabetesStatus,
          giConditions,
          providerId: selectedProviderId || null,
          pharmacyId: selectedPharmacyId || null,
        }),
      })
      const text = await res.text()
      let data: { error?: string } | null = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }

      if (res.ok) {
        alert('Account created. Please log in to your account.')
        router.push(`/login?email=${encodeURIComponent(form.email)}`)
      } else {
        alert(data?.error ?? text ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
      }
    } catch (err) {
      console.error('Registration request failed', err)
      alert('Could not submit registration. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-bold text-brand-700">💊 Butter Health</a>
          <span className="text-sm text-gray-500">Step {step} of 9</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
        {/* Progress */}
        <div className="mb-8">
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <div className="flex min-w-max items-center gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    s < step ? 'bg-brand-600 text-white' : s === step ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{s < step ? '✓' : s}</div>
                  {s < 9 && <div className={`h-0.5 w-8 sm:w-12 ${s < step ? 'bg-brand-600' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            {step === 1 ? 'Personal Info' : step === 2 ? 'Medical Info' : step === 3 ? 'Quick Questions' : step === 4 ? 'Heart Conditions' : step === 5 ? 'Endocrine / Kidney / Liver' : step === 6 ? 'Cancer' : step === 7 ? 'Diabetes' : step === 8 ? 'GI history' : 'Medication Preferences'}
          </div>
        </div>

        <div className="card">
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold mb-5">Personal Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">First Name *</label>
                  <input className="input" value={form.firstName} onChange={e => update('firstName', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input" value={form.lastName} onChange={e => update('lastName', e.target.value)} required />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Email *</label>
                  <input type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Phone *</label>
                  <input type="tel" className="input" value={form.phone} onChange={e => update('phone', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Date of Birth *</label>
                  <input type="date" className="input" value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} required />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Street Address</label>
                  <input className="input" value={form.address} onChange={e => update('address', e.target.value)} />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city} onChange={e => update('city', e.target.value)} />
                </div>
                <div>
                  <label className="label">ZIP Code</label>
                  <input className="input" value={form.zip} onChange={e => update('zip', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Create Password *</label>
                  <input type="password" className="input" placeholder="Min 8 characters" value={form.password} onChange={e => update('password', e.target.value)} required />
                  <p className="text-xs text-gray-500 mt-1">You&apos;ll use this to log in and check your order status.</p>
                </div>
              </div>
              <button
                className="btn-primary mt-6 w-full"
                onClick={() => {
                  if (!form.firstName || !form.lastName || !form.email || !form.phone || !form.dateOfBirth || !form.password)
                    return alert('Please fill all required fields.')
                  setStep(2)
                }}
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Medical History */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Medical History</h2>
              <p className="text-sm text-gray-500 mb-5">This information helps your provider evaluate you safely.</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Current Weight (lbs)</label>
                    <input className="input" value={form.weight} onChange={e => update('weight', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Height (e.g. 5&apos;8&quot;)</label>
                    <input className="input" value={form.height} onChange={e => update('height', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Known Allergies</label>
                  <textarea className="input" rows={2} value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="List any medication or food allergies, or write 'None'" />
                </div>
                <div>
                  <label className="label">Current Medications</label>
                  <textarea className="input" rows={2} value={form.currentMeds} onChange={e => update('currentMeds', e.target.value)} placeholder="List any current medications, or write 'None'" />
                </div>
                <div>
                  <label className="label">Relevant Medical History</label>
                  <textarea className="input" rows={3} value={form.medicalHistory} onChange={e => update('medicalHistory', e.target.value)} placeholder="Diabetes, thyroid issues, heart conditions, prior GLP-1 use, etc." />
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button className="btn-secondary flex-1" onClick={() => setStep(1)}>← Back</button>
                <button className="btn-primary flex-1" onClick={() => setStep(3)}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 3: Quick single-click question */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Quick Questions</h2>
              <p className="text-sm text-gray-500 mb-5">Have you seen your primary care provider in the past 12 months?</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button className={`btn-primary w-full sm:w-auto ${pcpSeen === true ? 'opacity-100' : 'opacity-90'}`} onClick={() => { setPcpSeen(true); setStep(4) }}>Yes</button>
                <button className={`btn-secondary w-full sm:w-auto ${pcpSeen === false ? 'opacity-100' : 'opacity-90'}`} onClick={() => { setPcpSeen(false); setStep(4) }}>No</button>
              </div>
            </div>
          )}

          {/* Step 4: Heart conditions checklist */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Heart / Cardiac Conditions</h2>
              <p className="text-sm text-gray-500 mb-4">Do you currently have, or have you ever been diagnosed with, any of the following?</p>
              <div className="space-y-2">
                {heartOptions.map(opt => (
                  <label key={opt} className="flex items-center gap-3">
                    <input type="checkbox" checked={heartConditions.includes(opt)} onChange={() => {
                      setHeartConditions(cur => cur.includes(opt) ? cur.filter(i => i !== opt) : [...cur, opt])
                    }} />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
                {showOtherHeart ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input className="input" value={otherHeart} onChange={e => setOtherHeart(e.target.value)} placeholder="Describe other heart condition" />
                    <button className="btn-primary" onClick={() => { if (otherHeart.trim()) { setHeartConditions(c => [...c, otherHeart.trim()]); setOtherHeart(''); setShowOtherHeart(false) } }}>Add</button>
                    <button className="btn-secondary" onClick={() => { setShowOtherHeart(false); setOtherHeart('') }}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-link mt-2 text-sm" onClick={() => setShowOtherHeart(true)}>Add other</button>
                )}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button className="btn-secondary flex-1" onClick={() => setStep(3)}>← Back</button>
                <button className="btn-primary flex-1" onClick={() => setStep(5)}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 5: Endocrine / Kidney / Liver checklist */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Hormone, Kidney, or Liver Conditions</h2>
              <p className="text-sm text-gray-500 mb-4">Do you currently have, or have you ever been diagnosed with, any of the following?</p>
              <div className="space-y-2">
                {endocrineOptions.map(opt => (
                  <label key={opt} className="flex items-center gap-3">
                    <input type="checkbox" checked={endocrineConditions.includes(opt)} onChange={() => {
                      setEndocrineConditions(cur => cur.includes(opt) ? cur.filter(i => i !== opt) : [...cur, opt])
                    }} />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
                {showOtherEndocrine ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input className="input" value={otherEndocrine} onChange={e => setOtherEndocrine(e.target.value)} placeholder="Describe other condition" />
                    <button className="btn-primary" onClick={() => { if (otherEndocrine.trim()) { setEndocrineConditions(c => [...c, otherEndocrine.trim()]); setOtherEndocrine(''); setShowOtherEndocrine(false) } }}>Add</button>
                    <button className="btn-secondary" onClick={() => { setShowOtherEndocrine(false); setOtherEndocrine('') }}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-link mt-2 text-sm" onClick={() => setShowOtherEndocrine(true)}>Add other</button>
                )}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button className="btn-secondary flex-1" onClick={() => setStep(4)}>← Back</button>
                <button className="btn-primary flex-1" onClick={() => setStep(6)}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 6: Cancer history */}
          {step === 6 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Cancer History</h2>
              <p className="text-sm text-gray-500 mb-4">Have you or a family member ever been diagnosed with cancer?</p>
              <div className="space-y-3">
                {cancerOptions.map(opt => (
                  <button key={opt} className={`w-full text-left p-3 rounded border ${cancerHistory === opt ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`} onClick={() => setCancerHistory(opt)}>
                    {opt}
                </button>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button className="btn-secondary flex-1" onClick={() => setStep(5)}>← Back</button>
                <button className="btn-primary flex-1" onClick={() => setStep(7)} disabled={!cancerHistory}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 7: Diabetes */}
          {step === 7 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Diabetes</h2>
              <p className="text-sm text-gray-500 mb-4">Do you currently have any of these?</p>
              <div className="space-y-3">
                {diabetesOptions.map(opt => (
                  <button key={opt} className={`w-full text-left p-3 rounded border ${diabetesStatus === opt ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`} onClick={() => setDiabetesStatus(opt)}>
                    {opt}
                </button>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button className="btn-secondary flex-1" onClick={() => setStep(6)}>← Back</button>
                <button className="btn-primary flex-1" onClick={() => setStep(8)} disabled={!diabetesStatus}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 8: GI conditions */}
          {step === 8 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Gastrointestinal History</h2>
              <p className="text-sm text-gray-500 mb-4">Do you currently have, or have a history of, any of the following?</p>
              <div className="space-y-2">
                {giOptions.map(opt => (
                  <label key={opt} className="flex items-center gap-3">
                    <input type="checkbox" checked={giConditions.includes(opt)} onChange={() => setGiConditions(cur => cur.includes(opt) ? cur.filter(i => i !== opt) : [...cur, opt])} />
                    <span className="text-sm">{opt}</span>
                  </label>
                ))}
                {showOtherGi ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input className="input" value={otherGi} onChange={e => setOtherGi(e.target.value)} placeholder="Describe other GI condition" />
                    <button className="btn-primary" onClick={() => { if (otherGi.trim()) { setGiConditions(c => [...c, otherGi.trim()]); setOtherGi(''); setShowOtherGi(false) } }}>Add</button>
                    <button className="btn-secondary" onClick={() => { setShowOtherGi(false); setOtherGi('') }}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-link mt-2 text-sm" onClick={() => setShowOtherGi(true)}>Add other</button>
                )}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button className="btn-secondary flex-1" onClick={() => setStep(7)}>← Back</button>
                <button className="btn-primary flex-1" onClick={() => setStep(9)}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 9: Choose Medication */}
          {step === 9 && (
            <div>
              <h2 className="text-xl font-bold mb-2">Medication Preferences</h2>
              <p className="text-sm text-gray-500 mb-5">Choose up to 2 options you are interested in. Your provider will make the final prescription decision.</p>
              <div className="grid grid-cols-1 gap-4 mb-4">
                <div>
                  <label className="label">Choose Your Provider</label>
                  <select className="input" value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)}>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.user.name}{provider.specialty ? ` • ${provider.specialty}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Choose Your Pharmacy</label>
                  <select className="input" value={selectedPharmacyId} onChange={(e) => setSelectedPharmacyId(e.target.value)}>
                    {pharmacies.map((pharmacy) => (
                      <option key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.user.name}{pharmacy.isDefault ? ' (Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="mb-3 text-sm text-gray-600">Select up to 2 medications. ({selectedMeds.length}/2 selected)</div>
                {medications.map(med => (
                  <label
                    key={med.id}
                    className={`block cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                      selectedMeds.includes(med.id) ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="medication"
                      value={med.id}
                      checked={selectedMeds.includes(med.id)}
                      onChange={() => {
                        setSelectedMeds(current => {
                          if (current.includes(med.id)) {
                            return current.filter(id => id !== med.id)
                          }
                          if (current.length >= 2) {
                            alert('You can select up to 2 medications.')
                            return current
                          }
                          return [...current, med.id]
                        })
                      }}
                      className="sr-only"
                    />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{med.name}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{med.description}</div>
                        <div className="text-xs text-gray-400 mt-1">Qty: {med.quantity}</div>
                      </div>
                      <div className="flex-shrink-0 sm:ml-4 sm:text-right">
                        <div className="font-bold text-brand-700 text-lg">${med.price}</div>
                        <div className="text-xs text-gray-400">one-time</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button className="btn-secondary flex-1" onClick={() => setStep(8)}>← Back</button>
                <button
                  className="btn-primary flex-1"
                  disabled={selectedMeds.length === 0 || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Submitting…' : 'Submit Preferences & Continue →'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your information is protected under HIPAA and is shared only with your treating provider and pharmacy.
        </p>
      </main>
    </div>
  )
}
