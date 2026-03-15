import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, ChevronRight, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import AIUploadSection from '../../components/registration/AIUploadSection'
import AIFilledField from '../../components/registration/AIFilledField'
import StepIndicator from '../../components/registration/StepIndicator'
import { extractIndustryDataFromPDF } from '../../services/ai/prithviAIService'
import { createIndustryApplication } from '../../services/firestore/industryApplicationsService'

const DISTRICTS = ['Raipur', 'Durg', 'Bilaspur', 'Korba', 'Raigarh', 'Janjgir-Champa', 'Surguja', 'Rajnandgaon', 'Bastar', 'Dhamtari', 'Mahasamund', 'Kanker', 'Kabirdham', 'Kondagaon', 'Narayanpur', 'Bijapur', 'Sukma', 'Dantewada', 'Gariaband', 'Balod', 'Bemetara', 'Mungeli', 'Surajpur', 'Balrampur', 'Jashpur', 'Korea', 'Manendragarh', 'Sakti', 'Sarangarh-Bilaigarh', 'Mohla-Manpur', 'Khairagarh']
const STEPS = [{ title: 'Basic Industry Information' }, { title: 'Consent to Establish' }, { title: 'Consent to Operate' }]
const EQUIPMENT = ['ESP', 'Bag Filter', 'Scrubber', 'Cyclone', 'None', 'Other']
const FIELD_MAP = { industryName: ['step1', 'industryName'], industryType: ['step1', 'industryType'], constitution: ['step1', 'constitution'], authorizedSignatory: ['step1', 'authorizedSignatoryName'], registeredAddress: ['step1', 'registeredAddress'], city: ['step1', 'cityVillage'], district: ['step1', 'district'], pinCode: ['step1', 'pinCode'], contactNumber: ['step1', 'contactNumber'], email: ['step1', 'emailAddress'], gstNumber: ['step1', 'gstNumber'], cinNumber: ['step1', 'cinRegistrationNumber'], panNumber: ['step1', 'panNumber'], natureOfIndustry: ['step2', 'natureOfIndustry'], totalPlotArea: ['step2', 'totalPlotArea'], waterConsumption: ['step2', 'totalWaterConsumption'], numberOfStacks: ['step2', 'numberOfStacks'], proposedCommencementDate: ['step2', 'proposedDateOfCommencement'] }

const INITIAL_FORM = {
  step1: { industryName: '', industryCategory: '', industryType: '', constitution: '', authorizedSignatoryName: '', authorizedSignatoryDesignation: '', registeredAddress: '', district: '', cityVillage: '', pinCode: '', latitude: '', longitude: '', contactNumber: '', emailAddress: '', gstNumber: '', cinRegistrationNumber: '', panNumber: '' },
  step2: { natureOfIndustry: '', mainRawMaterialsUsed: [{ material: '', quantityPerDay: '', unit: '' }], mainProductsManufactured: [{ product: '', capacityPerDay: '', unit: '' }], totalPlotArea: '', totalBuiltUpArea: '', totalWaterConsumption: '', sourceOfWater: '', totalWastewaterGenerated: '', wastewaterTreatmentMethod: '', numberOfStacks: '', stackDetails: [{ stackId: '', height: '', diameter: '', fuelType: '', fuelConsumptionPerDay: '' }], airPollutionControlEquipment: [], solidWasteGenerated: '', solidWasteDisposalMethod: '', proposedDateOfCommencement: '' },
  step3: { currentOperationalStatus: '', actualProductionCapacity: '', effluentDischargePoint: '', effluentDischargeQuantity: '', onlineEffluentMonitoring: '', onlineStackMonitoring: '', previousConsentNumber: '', previousConsentValidUntil: '', pendingLegalNotices: '', pendingLegalNoticeDetails: '', declarationAccepted: false, authorizedSignatoryName: '', date: new Date().toISOString().slice(0, 10) },
}

const ROW_FACTORIES = {
  mainRawMaterialsUsed: () => ({ material: '', quantityPerDay: '', unit: '' }),
  mainProductsManufactured: () => ({ product: '', capacityPerDay: '', unit: '' }),
  stackDetails: () => ({ stackId: '', height: '', diameter: '', fuelType: '', fuelConsumptionPerDay: '' }),
}

const STEP1_FIELDS = [
  { section: 'step1', key: 'industryName', label: 'Industry/Unit Name', required: true, ai: true },
  { section: 'step1', key: 'industryCategory', label: 'Industry Category', type: 'select', options: ['Red', 'Orange', 'Green', 'White'], required: true },
  { section: 'step1', key: 'industryType', label: 'Industry Type', type: 'select', options: ['Steel', 'Cement', 'Power Plant', 'Mining', 'Textile', 'Chemical', 'Fertilizer', 'Distillery', 'Other'], required: true, ai: true },
  { section: 'step1', key: 'constitution', label: 'Constitution', type: 'select', options: ['Proprietorship', 'Partnership', 'Pvt Ltd', 'Public Ltd', 'PSU', 'Government'], required: true, ai: true },
  { section: 'step1', key: 'authorizedSignatoryName', label: 'Authorized Signatory Name', required: true, ai: true },
  { section: 'step1', key: 'authorizedSignatoryDesignation', label: 'Authorized Signatory Designation' },
  { section: 'step1', key: 'district', label: 'District', type: 'select', options: DISTRICTS, ai: true },
  { section: 'step1', key: 'cityVillage', label: 'City / Village', ai: true },
  { section: 'step1', key: 'pinCode', label: 'Pin Code', ai: true },
  { section: 'step1', key: 'latitude', label: 'Latitude', type: 'number' },
  { section: 'step1', key: 'longitude', label: 'Longitude', type: 'number' },
  { section: 'step1', key: 'contactNumber', label: 'Contact Number', required: true, ai: true },
  { section: 'step1', key: 'emailAddress', label: 'Email Address', type: 'email', required: true, ai: true },
  { section: 'step1', key: 'gstNumber', label: 'GST Number', ai: true },
  { section: 'step1', key: 'cinRegistrationNumber', label: 'CIN / Registration Number', ai: true },
  { section: 'step1', key: 'panNumber', label: 'PAN Number', ai: true },
]

const STEP2_FIELDS = [
  { section: 'step2', key: 'totalPlotArea', label: 'Total Plot Area (sq. metres)', type: 'number', ai: true },
  { section: 'step2', key: 'totalBuiltUpArea', label: 'Total Built-up Area (sq. metres)', type: 'number' },
  { section: 'step2', key: 'totalWaterConsumption', label: 'Total Water Consumption (KLD)', type: 'number', ai: true },
  { section: 'step2', key: 'sourceOfWater', label: 'Source of Water', type: 'select', options: ['Groundwater', 'Surface Water', 'Municipal Supply', 'Recycled'] },
  { section: 'step2', key: 'totalWastewaterGenerated', label: 'Total Wastewater Generated (KLD)', type: 'number' },
  { section: 'step2', key: 'wastewaterTreatmentMethod', label: 'Wastewater Treatment Method', type: 'select', options: ['ETP', 'STP', 'CETP', 'None'] },
  { section: 'step2', key: 'numberOfStacks', label: 'Number of Stacks / Chimneys', type: 'number', ai: true },
  { section: 'step2', key: 'solidWasteGenerated', label: 'Solid Waste Generated (MT/day)', type: 'number' },
  { section: 'step2', key: 'solidWasteDisposalMethod', label: 'Solid Waste Disposal Method', type: 'select', options: ['Landfill', 'Incineration', 'Recycling', 'TSDF', 'Other'] },
  { section: 'step2', key: 'proposedDateOfCommencement', label: 'Proposed Date of Commencement', type: 'date', ai: true },
]

const STEP3_FIELDS = [
  { section: 'step3', key: 'currentOperationalStatus', label: 'Current Operational Status', type: 'select', options: ['Operational', 'Under Construction', 'Shut Down'], required: true },
  { section: 'step3', key: 'actualProductionCapacity', label: 'Actual Production Capacity (% of proposed)', type: 'number' },
  { section: 'step3', key: 'effluentDischargePoint', label: 'Effluent Discharge Point' },
  { section: 'step3', key: 'effluentDischargeQuantity', label: 'Effluent Discharge Quantity (KLD)', type: 'number' },
  { section: 'step3', key: 'onlineEffluentMonitoring', label: 'Online Effluent Monitoring (CEQMS)', type: 'select', options: ['Installed', 'Not Installed', 'In Process'] },
  { section: 'step3', key: 'onlineStackMonitoring', label: 'Online Stack Monitoring (CEMS)', type: 'select', options: ['Installed', 'Not Installed', 'In Process'] },
  { section: 'step3', key: 'previousConsentNumber', label: 'Previous Consent Number' },
  { section: 'step3', key: 'previousConsentValidUntil', label: 'Previous Consent Valid Until', type: 'date' },
  { section: 'step3', key: 'authorizedSignatoryName', label: 'Authorized Signatory Name' },
  { section: 'step3', key: 'date', label: 'Date', type: 'date' },
]

export default function IndustryRegistrationPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL_FORM)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiState, setAiState] = useState({ result: null, error: '' })
  const [aiFields, setAiFields] = useState([])
  const [modifiedAiFields, setModifiedAiFields] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  const aiFieldSet = useMemo(() => new Set(aiFields), [aiFields])
  const modifiedFieldSet = useMemo(() => new Set(modifiedAiFields), [modifiedAiFields])

  function onField(section, key, value) {
    setForm((prev) => {
      const next = { ...prev, [section]: { ...prev[section], [key]: value } }
      if (section === 'step1' && key === 'authorizedSignatoryName') next.step3 = { ...next.step3, authorizedSignatoryName: value }
      return next
    })
    const fieldKey = `${section}.${key}`
    if (aiFieldSet.has(fieldKey) && !modifiedFieldSet.has(fieldKey)) setModifiedAiFields((prev) => [...prev, fieldKey])
  }

  function onList(field, index, key, value) {
    setForm((prev) => ({
      ...prev,
      step2: {
        ...prev.step2,
        [field]: prev.step2[field].map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
      },
    }))
  }

  function onAddRow(field) {
    setForm((prev) => ({ ...prev, step2: { ...prev.step2, [field]: [...prev.step2[field], ROW_FACTORIES[field]()] } }))
  }

  function onRemoveRow(field, index) {
    setForm((prev) => ({ ...prev, step2: { ...prev.step2, [field]: prev.step2[field].filter((_, rowIndex) => rowIndex !== index) } }))
  }

  async function onAiUpload(file) {
    if (file.type !== 'application/pdf') return setAiState({ result: null, error: 'Only PDF files are supported for AI extraction.' })
    if (file.size > 10 * 1024 * 1024) return setAiState({ result: null, error: 'The selected PDF is larger than 10MB. Please upload a smaller file.' })
    setAiLoading(true)
    const result = await extractIndustryDataFromPDF(file)
    setAiLoading(false)
    setAiState({ result, error: result.error ?? '' })
    if (result.error) return

    const filled = []
    setForm((prev) => {
      const next = { ...prev, step1: { ...prev.step1 }, step2: { ...prev.step2 }, step3: { ...prev.step3 } }
      Object.entries(result.data ?? {}).forEach(([from, value]) => {
        if (value === null || value === '') return
        const target = FIELD_MAP[from]
        if (!target) return
        const [section, key] = target
        next[section][key] = String(value)
        filled.push(`${section}.${key}`)
      })
      next.step3.authorizedSignatoryName = next.step1.authorizedSignatoryName
      return next
    })
    setAiFields(filled)
    setModifiedAiFields([])
  }

  function validate(currentStep) {
    if (currentStep === 1) {
      const required = [['Industry/Unit Name', form.step1.industryName], ['Industry Category', form.step1.industryCategory], ['Industry Type', form.step1.industryType], ['Constitution', form.step1.constitution], ['Authorized Signatory Name', form.step1.authorizedSignatoryName], ['Registered Address', form.step1.registeredAddress], ['Contact Number', form.step1.contactNumber], ['Email Address', form.step1.emailAddress]]
      const missing = required.find(([, value]) => !String(value ?? '').trim())
      return missing ? `Please complete ${missing[0]} before continuing.` : ''
    }
    if (currentStep === 3) {
      if (!form.step3.currentOperationalStatus) return 'Please select the current operational status before submitting.'
      if (!form.step3.declarationAccepted) return 'Please accept the declaration before submitting the application.'
    }
    return ''
  }

  function nextStep() {
    const message = validate(step)
    setError(message)
    if (!message) setStep((prev) => Math.min(prev + 1, 3))
  }

  async function submit() {
    const message = validate(3)
    setError(message)
    if (message) return
    setSubmitting(true)
    try {
      const created = await createIndustryApplication({
        ...normalizeForm(form),
        aiAssisted: aiFields.length > 0,
        aiExtractedFields: aiFields,
      })
      localStorage.setItem('prithvinetIndustryApplicationId', created.applicationId)
      setSubmitted(created)
    } catch (submitError) {
      console.error('Application submission failed:', submitError)
      setError('Submission failed. Please try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-[32px] border border-emerald-100 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-10 w-10" /></div>
          <p className="mt-6 text-[11px] uppercase tracking-[0.38em] text-emerald-600">Application Submitted</p>
          <h1 className="mt-3 text-4xl font-semibold text-gray-900">Registration request received</h1>
          <p className="mt-4 text-base text-gray-600">CECB will review your application within 7 working days. Keep your application ID safe to track the review status.</p>
          <div className="mt-8 rounded-[28px] border border-gray-100 bg-gray-50 p-6">
            <p className="text-sm text-gray-500">Application ID</p>
            <p className="mt-2 text-3xl font-semibold tracking-[0.16em] text-primary-700">{submitted.applicationId}</p>
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register/status" className="btn-primary">Track Application Status</Link>
            <Link to="/public" className="btn-secondary">Return to Citizen Portal</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
        <div className="space-y-6">
          <AIUploadSection loading={aiLoading} result={aiState.result} error={aiState.error} onFileSelect={onAiUpload} onSkip={() => setAiState({ result: null, error: '' })} />
          <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.38em] text-gray-400">Why this flow exists</p>
            <h2 className="mt-3 text-2xl font-semibold text-gray-900">Bring the full registration journey inside PrithviNet</h2>
            <div className="mt-5 grid gap-4">
              <InfoCard title="Public-first access" text="Applicants do not need a login to start, submit, or track their application status." />
              <InfoCard title="AI-assisted verification" text="Digital PDFs can pre-fill fields, but every highlighted value should still be checked before submission." />
              <InfoCard title="Manual admin approval" text="Applications remain pending until a Super Admin reviews and approves or rejects them." icon={ShieldCheck} />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <StepIndicator currentStep={step} steps={STEPS} />
          {aiFields.length > 0 && <div className="alert-solid-warning text-sm">AI has pre-filled fields highlighted in yellow. Please verify each one before continuing.</div>}
          {error && <div className="alert-solid-error text-sm">{error}</div>}
          <div className="rounded-[32px] border border-[#dde7e4] bg-white p-6 shadow-sm">
            {step === 1 && <StepOne values={form.step1} onField={onField} aiFieldSet={aiFieldSet} modifiedFieldSet={modifiedFieldSet} />}
            {step === 2 && <StepTwo values={form.step2} onField={onField} onList={onList} onAddRow={onAddRow} onRemoveRow={onRemoveRow} />}
            {step === 3 && <StepThree values={form.step3} onField={onField} />}
            <div className="mt-8 flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => setStep((prev) => Math.max(prev - 1, 1))} disabled={step === 1} className="btn-secondary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft className="h-4 w-4" />Back</button>
              {step < 3 ? <button type="button" onClick={nextStep} className="btn-primary inline-flex items-center justify-center gap-2">Next<ChevronRight className="h-4 w-4" /></button> : <button type="button" onClick={submit} disabled={submitting} className="btn-primary">{submitting ? 'Submitting...' : 'Submit Application'}</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ title, text, icon: Icon = ShieldCheck }) {
  return <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-4"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-700"><Icon className="h-5 w-5" /></div><h3 className="text-base font-semibold text-gray-900">{title}</h3><p className="mt-2 text-sm leading-6 text-gray-600">{text}</p></div>
}

function StepOne({ values, onField, aiFieldSet, modifiedFieldSet }) {
  return <div className="space-y-5"><div><p className="text-[11px] uppercase tracking-[0.34em] text-gray-400">Step 1 of 3</p><h2 className="mt-2 text-2xl font-semibold text-gray-900">Basic Industry Information</h2></div><div className="grid gap-4 md:grid-cols-2">{STEP1_FIELDS.map((field) => <SmartField key={field.key} field={field} value={values[field.key]} onChange={(value) => onField(field.section, field.key, value)} aiFilled={aiFieldSet.has(`${field.section}.${field.key}`)} modified={modifiedFieldSet.has(`${field.section}.${field.key}`)} />)}<SmartField field={{ section: 'step1', key: 'registeredAddress', label: 'Registered Address', type: 'textarea', required: true }} value={values.registeredAddress} onChange={(value) => onField('step1', 'registeredAddress', value)} className="md:col-span-2" aiFilled={aiFieldSet.has('step1.registeredAddress')} modified={modifiedFieldSet.has('step1.registeredAddress')} /></div></div>
}

function StepTwo({ values, onField, onList, onAddRow, onRemoveRow }) {
  return <div className="space-y-6"><div><p className="text-[11px] uppercase tracking-[0.34em] text-gray-400">Step 2 of 3</p><h2 className="mt-2 text-2xl font-semibold text-gray-900">Consent to Establish - Production Details</h2></div><SmartField field={{ section: 'step2', key: 'natureOfIndustry', label: 'Nature of Industry / Activity', type: 'textarea' }} value={values.natureOfIndustry} onChange={(value) => onField('step2', 'natureOfIndustry', value)} /><DynamicRows title="Main Raw Materials Used" rows={values.mainRawMaterialsUsed} columns={[['material', 'Material'], ['quantityPerDay', 'Quantity / day', 'number'], ['unit', 'Unit']]} onChange={(index, key, value) => onList('mainRawMaterialsUsed', index, key, value)} onAdd={() => onAddRow('mainRawMaterialsUsed')} onRemove={(index) => onRemoveRow('mainRawMaterialsUsed', index)} /><DynamicRows title="Main Products Manufactured" rows={values.mainProductsManufactured} columns={[['product', 'Product'], ['capacityPerDay', 'Capacity / day', 'number'], ['unit', 'Unit']]} onChange={(index, key, value) => onList('mainProductsManufactured', index, key, value)} onAdd={() => onAddRow('mainProductsManufactured')} onRemove={(index) => onRemoveRow('mainProductsManufactured', index)} /><div className="grid gap-4 md:grid-cols-2">{STEP2_FIELDS.map((field) => <SmartField key={field.key} field={field} value={values[field.key]} onChange={(value) => onField(field.section, field.key, value)} />)}</div><div className="rounded-[24px] border border-gray-100 bg-gray-50 p-4"><div className="mb-3"><p className="text-sm font-semibold text-gray-900">Air Pollution Control Equipment</p><p className="text-xs text-gray-500">Choose all equipment planned for the unit.</p></div><div className="flex flex-wrap gap-3">{EQUIPMENT.map((option) => <button key={option} type="button" onClick={() => onField('step2', 'airPollutionControlEquipment', values.airPollutionControlEquipment.includes(option) ? values.airPollutionControlEquipment.filter((item) => item !== option) : [...values.airPollutionControlEquipment, option])} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${values.airPollutionControlEquipment.includes(option) ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700'}`}>{option}</button>)}</div></div><DynamicRows title="Stack Details" rows={values.stackDetails} columns={[['stackId', 'Stack ID'], ['height', 'Height (m)', 'number'], ['diameter', 'Diameter (m)', 'number'], ['fuelType', 'Fuel Type'], ['fuelConsumptionPerDay', 'Fuel Consumption / day']]} onChange={(index, key, value) => onList('stackDetails', index, key, value)} onAdd={() => onAddRow('stackDetails')} onRemove={(index) => onRemoveRow('stackDetails', index)} /></div>
}

function StepThree({ values, onField }) {
  return <div className="space-y-5"><div><p className="text-[11px] uppercase tracking-[0.34em] text-gray-400">Step 3 of 3</p><h2 className="mt-2 text-2xl font-semibold text-gray-900">Consent to Operate - Compliance Declaration</h2></div><div className="grid gap-4 md:grid-cols-2">{STEP3_FIELDS.map((field) => <SmartField key={field.key} field={field} value={values[field.key]} onChange={(value) => onField(field.section, field.key, value)} />)}<div className="md:col-span-2"><p className="mb-2 text-sm font-medium text-gray-700">Any pending legal notices from CECB?</p><div className="flex gap-3">{['Yes', 'No'].map((option) => <button key={option} type="button" onClick={() => onField('step3', 'pendingLegalNotices', option)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${values.pendingLegalNotices === option ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-200 bg-white text-gray-600'}`}>{option}</button>)}</div></div>{values.pendingLegalNotices === 'Yes' && <SmartField field={{ section: 'step3', key: 'pendingLegalNoticeDetails', label: 'If yes, provide details', type: 'textarea' }} value={values.pendingLegalNoticeDetails} onChange={(value) => onField('step3', 'pendingLegalNoticeDetails', value)} className="md:col-span-2" />}</div><label className="flex items-start gap-3 rounded-[24px] border border-gray-100 bg-gray-50 p-4"><input type="checkbox" checked={values.declarationAccepted} onChange={(event) => onField('step3', 'declarationAccepted', event.target.checked)} className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-700 focus:ring-primary-600" /><span className="text-sm leading-6 text-gray-700">I hereby declare that the information provided is true and correct to the best of my knowledge. I understand that false information may result in rejection of this application and legal action.</span></label></div>
}

function SmartField({ field, value, onChange, className = '', aiFilled = false, modified = false }) {
  const body = field.type === 'select'
    ? <select value={value} onChange={(event) => onChange(event.target.value)} className="input-base"><option value="">Select an option</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
    : field.type === 'textarea'
      ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="input-base min-h-[120px]" />
      : <input type={field.type ?? 'text'} value={value} onChange={(event) => onChange(event.target.value)} className="input-base" />
  return <div className={className}><AIFilledField aiFilled={aiFilled} modified={modified}><label className="block"><span className="mb-2 block text-sm font-medium text-gray-700">{field.label} {field.required && <span className="text-red-500">*</span>}</span>{body}</label></AIFilledField></div>
}

function DynamicRows({ title, rows, columns, onChange, onAdd, onRemove }) {
  return <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-4"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-gray-900">{title}</p><p className="text-xs text-gray-500">Add one or more rows as needed.</p></div><button type="button" onClick={onAdd} className="btn-secondary inline-flex items-center gap-2"><Plus className="h-4 w-4" />Add Row</button></div><div className="space-y-3">{rows.map((row, index) => <div key={`${title}-${index}`} className="rounded-2xl border border-white bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">{columns.map(([key, label, type = 'text']) => <label key={key} className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{label}</span><input type={type} value={row[key]} onChange={(event) => onChange(index, key, event.target.value)} className="input-base" /></label>)}</div>{rows.length > 1 && <div className="mt-3 flex justify-end"><button type="button" onClick={() => onRemove(index)} className="inline-flex items-center gap-2 text-sm font-medium text-red-600"><Trash2 className="h-4 w-4" />Remove</button></div>}</div>)}</div></div>
}

function normalizeForm(form) {
  return {
    step1: { ...form.step1, latitude: nullableNumber(form.step1.latitude), longitude: nullableNumber(form.step1.longitude) },
    step2: { ...form.step2, totalPlotArea: nullableNumber(form.step2.totalPlotArea), totalBuiltUpArea: nullableNumber(form.step2.totalBuiltUpArea), totalWaterConsumption: nullableNumber(form.step2.totalWaterConsumption), totalWastewaterGenerated: nullableNumber(form.step2.totalWastewaterGenerated), numberOfStacks: nullableNumber(form.step2.numberOfStacks), solidWasteGenerated: nullableNumber(form.step2.solidWasteGenerated), mainRawMaterialsUsed: form.step2.mainRawMaterialsUsed.filter(hasAnyValue), mainProductsManufactured: form.step2.mainProductsManufactured.filter(hasAnyValue), stackDetails: form.step2.stackDetails.filter(hasAnyValue).map((row) => ({ ...row, height: nullableNumber(row.height), diameter: nullableNumber(row.diameter) })) },
    step3: { ...form.step3, actualProductionCapacity: nullableNumber(form.step3.actualProductionCapacity), effluentDischargeQuantity: nullableNumber(form.step3.effluentDischargeQuantity) },
  }
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasAnyValue(row) {
  return Object.values(row).some((value) => String(value ?? '').trim() !== '')
}
