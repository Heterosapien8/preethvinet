import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Eye, LoaderCircle, ShieldAlert, XCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  approveIndustryApplication,
  INDUSTRY_APPLICATION_STATUS,
  markApplicationUnderReview,
  rejectIndustryApplication,
  subscribeToIndustryApplications,
} from '../../services/firestore/industryApplicationsService'

const FILTERS = [
  ['All', 'ALL'],
  ['Submitted', INDUSTRY_APPLICATION_STATUS.SUBMITTED],
  ['Under Review', INDUSTRY_APPLICATION_STATUS.UNDER_REVIEW],
  ['Approved', INDUSTRY_APPLICATION_STATUS.APPROVED],
  ['Rejected', INDUSTRY_APPLICATION_STATUS.REJECTED],
]

export default function IndustryApplicationsPage() {
  const { currentUser, userProfile } = useAuth()
  const [filter, setFilter] = useState('ALL')
  const [applications, setApplications] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reviewNotes, setReviewNotes] = useState('')
  const [action, setAction] = useState('')

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeToIndustryApplications(filter, (items) => {
      setApplications(items)
      setSelectedId((prev) => prev && items.some((item) => item.id === prev) ? prev : items[0]?.id ?? null)
      setLoading(false)
    })
    return unsubscribe
  }, [filter])

  const selected = useMemo(() => applications.find((item) => item.id === selectedId) ?? null, [applications, selectedId])

  async function handleApprove() {
    if (!selected) return
    setAction('approve')
    try {
      await approveIndustryApplication(selected.id, { uid: currentUser?.uid, name: userProfile?.name })
    } finally {
      setAction('')
    }
  }

  async function handleReject() {
    if (!selected || !reviewNotes.trim()) return
    setAction('reject')
    try {
      await rejectIndustryApplication(selected.id, currentUser?.uid, reviewNotes)
      setReviewNotes('')
    } finally {
      setAction('')
    }
  }

  async function handleReview() {
    if (!selected) return
    setAction('review')
    try {
      await markApplicationUnderReview(selected.id, currentUser?.uid)
    } finally {
      setAction('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.36em] text-gray-400">Super Admin Review Desk</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">Industry registration applications</h1>
            <p className="mt-2 text-sm text-gray-600">Review public submissions, mark them under review, then approve or reject with notes.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {FILTERS.map(([label, value]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === value ? 'bg-primary-700 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700'}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="rounded-[30px] border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Applications</h2>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">{applications.length}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-14"><LoaderCircle className="h-8 w-8 animate-spin text-primary-700" /></div>
          ) : applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">No applications found for this filter.</div>
          ) : (
            <div className="space-y-3">
              {applications.map((application) => (
                <button key={application.id} type="button" onClick={() => setSelectedId(application.id)} className={`w-full rounded-[24px] border p-4 text-left transition ${selectedId === application.id ? 'border-primary-700 bg-primary-50' : 'border-gray-100 bg-gray-50 hover:border-primary-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{application.step1?.industryName || 'Unnamed Industry'}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-gray-400">{application.applicationId}</p>
                    </div>
                    <StatusPill status={application.status} />
                  </div>
                  <p className="mt-3 text-xs text-gray-500">{application.step1?.district || 'District not provided'}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-sm">
          {!selected ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">Select an application to review the full submission.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.34em] text-gray-400">Application Detail</p>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-900">{selected.step1?.industryName || 'Unnamed Industry'}</h2>
                  <p className="mt-2 text-sm text-gray-500">{selected.applicationId}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={handleReview} disabled={action !== ''} className="btn-secondary inline-flex items-center gap-2"><Eye className="h-4 w-4" />{action === 'review' ? 'Updating...' : 'Mark Under Review'}</button>
                  <button type="button" onClick={handleApprove} disabled={action !== ''} className="btn-primary inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{action === 'approve' ? 'Approving...' : 'Approve'}</button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard title="Industry Type" value={selected.step1?.industryType || 'Not provided'} />
                <MetricCard title="Current Status" value={selected.status} />
                <MetricCard title="AI Assisted" value={selected.aiAssisted ? 'Yes' : 'No'} icon={ShieldAlert} />
              </div>

              <SectionCard title="Step 1 - Basic Industry Information" data={selected.step1} />
              <SectionCard title="Step 2 - Consent to Establish" data={selected.step2} />
              <SectionCard title="Step 3 - Consent to Operate" data={selected.step3} />

              <div className="rounded-[24px] border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">Reject application</p>
                <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={4} placeholder="Provide rejection notes for the applicant" className="input-base mt-3 bg-white" />
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={handleReject} disabled={!reviewNotes.trim() || action !== ''} className="btn-danger inline-flex items-center gap-2"><XCircle className="h-4 w-4" />{action === 'reject' ? 'Rejecting...' : 'Reject'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon: Icon = ShieldAlert }) {
  return <div className="rounded-[24px] border border-gray-100 bg-gray-50 p-4"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-700"><Icon className="h-5 w-5" /></div><p className="text-xs uppercase tracking-[0.2em] text-gray-400">{title}</p><p className="mt-2 text-lg font-semibold text-gray-900">{value}</p></div>
}

function StatusPill({ status }) {
  const styles = { SUBMITTED: 'bg-blue-100 text-blue-700', UNDER_REVIEW: 'bg-amber-100 text-amber-700', APPROVED: 'bg-emerald-100 text-emerald-700', REJECTED: 'bg-red-100 text-red-700' }
  return <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>{String(status).replaceAll('_', ' ')}</span>
}

function SectionCard({ title, data }) {
  return (
    <section className="rounded-[24px] border border-gray-100 bg-gray-50 p-5">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {Object.entries(data ?? {}).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-white bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{formatLabel(key)}</p>
            <div className="mt-2 text-sm text-gray-800">{renderValue(value)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function renderValue(value) {
  if (Array.isArray(value)) {
    if (!value.length) return 'None'
    return <div className="space-y-2">{value.map((item, index) => <pre key={index} className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs text-gray-700">{JSON.stringify(item, null, 2)}</pre>)}</div>
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined || value === '') return 'Not provided'
  return String(value)
}

function formatLabel(value) {
  return value.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())
}
