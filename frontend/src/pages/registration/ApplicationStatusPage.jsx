import { useState } from 'react'
import { Search, ShieldCheck, XCircle } from 'lucide-react'
import { getIndustryApplication } from '../../services/firestore/industryApplicationsService'

const STATUS_STYLES = {
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export default function ApplicationStatusPage() {
  const [applicationId, setApplicationId] = useState(localStorage.getItem('prithvinetIndustryApplicationId') ?? '')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function handleLookup(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const application = await getIndustryApplication(applicationId.trim())
      if (!application) {
        setError('No application was found for that ID. Please check and try again.')
      } else {
        setResult(application)
        localStorage.setItem('prithvinetIndustryApplicationId', application.applicationId)
      }
    } catch (lookupError) {
      console.error('Status lookup failed:', lookupError)
      setError('Status lookup failed. Please try again shortly.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-[32px] border border-gray-100 bg-white p-8 shadow-sm">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.38em] text-gray-400">Public Status Check</p>
          <h1 className="mt-3 text-4xl font-semibold text-gray-900">Track your industry registration application</h1>
          <p className="mt-3 text-base text-gray-600">
            Enter the application ID shown after submission to see the latest review status from CECB.
          </p>
        </div>

        <form onSubmit={handleLookup} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
            placeholder="Enter your Application ID"
            className="input-base flex-1"
          />
          <button type="submit" disabled={loading} className="btn-primary inline-flex items-center justify-center gap-2">
            <Search className="h-4 w-4" />
            {loading ? 'Checking...' : 'Check Status'}
          </button>
        </form>

        {error && <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {result && (
          <div className="mt-8 rounded-[28px] border border-gray-100 bg-gray-50 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm text-gray-500">Application ID</p>
                <p className="mt-1 text-2xl font-semibold text-primary-700">{result.applicationId}</p>
              </div>
              <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${STATUS_STYLES[result.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {String(result.status ?? '').replaceAll('_', ' ')}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <StatusCard icon={ShieldCheck} title="Industry Name" text={result.step1?.industryName || 'Not available'} />
              <StatusCard icon={ShieldCheck} title="Submitted Email" text={result.step1?.emailAddress || 'Not available'} />
            </div>

            {result.status === 'REJECTED' && (
              <div className="mt-6 rounded-2xl border border-red-100 bg-white p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Review notes</p>
                    <p className="mt-2 text-sm text-gray-700">{result.reviewNotes || 'No review notes were provided.'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusCard({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs uppercase tracking-[0.24em] text-gray-400">{title}</p>
      <p className="mt-2 text-base font-semibold text-gray-900">{text}</p>
    </div>
  )
}
