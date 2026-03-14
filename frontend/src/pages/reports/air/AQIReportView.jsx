import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  Factory,
  MapPin,
  ShieldCheck,
  Wind,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import clsx from 'clsx'
import { db } from '../../../config/firebase'
import { COLLECTIONS } from '../../../config/constants'
import { calculateAQI, getAQICategory } from '../../../utils/aqiCalculator'

const AMBIENT_PARAMS = [
  { key: 'PM10', label: 'PM10', unit: 'ug/m3', limit: 100 },
  { key: 'PM2_5', label: 'PM2.5', unit: 'ug/m3', limit: 60 },
  { key: 'SO2', label: 'SO2', unit: 'ug/m3', limit: 80 },
  { key: 'NO2', label: 'NO2', unit: 'ug/m3', limit: 80 },
  { key: 'O3', label: 'O3', unit: 'ug/m3', limit: 100 },
  { key: 'CO_8hr', label: 'CO (8hr)', unit: 'mg/m3', limit: 10 },
]

function formatDateTime(timestamp) {
  if (!timestamp?.toDate) return 'Not available'
  return format(timestamp.toDate(), 'dd MMM yyyy, hh:mm a')
}

function getStatusTone(isViolation) {
  return isViolation
    ? {
        badge: 'bg-red-100 text-red-700',
        card: 'from-red-500 to-orange-500',
        icon: AlertTriangle,
        label: 'Violation',
      }
    : {
        badge: 'bg-emerald-100 text-emerald-700',
        card: 'from-emerald-500 to-teal-600',
        icon: ShieldCheck,
        label: 'Compliant',
      }
}

export default function AQIReportView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reading, setReading] = useState(null)
  const [recentReadings, setRecentReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return

    let active = true
    async function loadReading() {
      setLoading(true)
      const snap = await getDoc(doc(db, COLLECTIONS.AIR_READINGS, id))
      if (!active) return

      if (!snap.exists()) {
        setNotFound(true)
        setReading(null)
        setLoading(false)
        return
      }

      setReading({ id: snap.id, ...snap.data() })
      setNotFound(false)
      setLoading(false)
    }

    loadReading()
    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (!reading) return

    const readingsQuery = query(
      collection(db, COLLECTIONS.AIR_READINGS),
      orderBy('createdAt', 'desc'),
      limit(20)
    )

    return onSnapshot(readingsQuery, (snapshot) => {
      const docs = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((item) => {
          if (item.id === reading.id) return true
          if (reading.locationId && item.locationId === reading.locationId) return true
          if (reading.industryId && item.industryId === reading.industryId) return true
          return false
        })
        .slice(0, 8)
        .reverse()

      setRecentReadings(docs)
    })
  }, [reading])

  const recalculated = useMemo(() => (
    reading?.ambientAir ? calculateAQI(reading.ambientAir) : null
  ), [reading])

  const aqiCategory = useMemo(() => (
    getAQICategory(reading?.aqi ?? recalculated?.aqi ?? 0)
  ), [reading, recalculated])

  const statusTone = getStatusTone(Boolean(reading?.isViolation))
  const StatusIcon = statusTone.icon

  const pollutantRows = useMemo(() => {
    const ambient = reading?.ambientAir ?? {}
    const subIndices = recalculated?.subIndices ?? {}

    return AMBIENT_PARAMS
      .map((param) => {
        const value = ambient[param.key]
        if (value === null || value === undefined) return null

        return {
          ...param,
          value,
          subIndex: subIndices[param.key] ?? null,
          breached: Number(value) > param.limit,
        }
      })
      .filter(Boolean)
  }, [reading, recalculated])

  const chartData = useMemo(() => {
    return recentReadings.map((item) => ({
      time: item.createdAt?.toDate ? format(item.createdAt.toDate(), 'dd MMM') : '-',
      aqi: item.aqi ?? 0,
      so2: item.ambientAir?.SO2 ?? null,
      pm25: item.ambientAir?.PM2_5 ?? null,
    }))
  }, [recentReadings])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !reading) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => navigate('/reports/air')}
          className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline"
        >
          <ArrowLeft size={16} />
          Back to Air Reports
        </button>
        <div className="card py-16 text-center text-gray-400">
          <p className="text-lg font-medium text-gray-700">Air monitoring report not found</p>
          <p className="mt-2 text-sm">The selected report may have been removed or is unavailable.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/reports/air')}
          className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline"
        >
          <ArrowLeft size={16} />
          Back to Air Reports
        </button>
        <Link to="/reports/air/new" className="btn-secondary">
          New Report
        </Link>
      </div>

      <div className="card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.34em] text-gray-400 mb-2">
              Detailed air report
            </p>
            <h1 className="page-title !text-3xl !font-semibold !text-gray-900">
              {reading.industryName ?? 'Air Monitoring Report'}
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Monitoring type: <span className="capitalize">{reading.monitoringType ?? 'package'}</span>
            </p>
          </div>

          <div className={clsx('rounded-[24px] bg-gradient-to-br text-white px-8 py-6 min-w-[300px] max-w-[360px]', statusTone.card)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/70">Report status</p>
                <p className="mt-4 text-4xl font-semibold leading-none">{reading.aqi ?? recalculated?.aqi ?? '-'}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-2.5">
                <StatusIcon size={18} className="text-white" />
              </div>
            </div>
            <p className="mt-4 text-sm text-white/85">
              AQI category: {reading.aqiCategory ?? recalculated?.category ?? 'No data'}
            </p>
            <span className={clsx('mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold', statusTone.badge)}>
              {statusTone.label}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Building2 size={15} />
              <p className="text-[10px] uppercase tracking-[0.24em]">Industry</p>
            </div>
            <p className="mt-3 text-lg font-semibold text-gray-800">{reading.industryName ?? '-'}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="flex items-center gap-2 text-gray-400">
              <MapPin size={15} />
              <p className="text-[10px] uppercase tracking-[0.24em]">Location</p>
            </div>
            <p className="mt-3 text-lg font-semibold text-gray-800">{reading.locationId ?? '-'}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="flex items-center gap-2 text-gray-400">
              <Factory size={15} />
              <p className="text-[10px] uppercase tracking-[0.24em]">Regional Office</p>
            </div>
            <p className="mt-3 text-lg font-semibold text-gray-800">{reading.roName ?? reading.roId ?? '-'}</p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <div className="flex items-center gap-2 text-gray-400">
              <CalendarDays size={15} />
              <p className="text-[10px] uppercase tracking-[0.24em]">Recorded</p>
            </div>
            <p className="mt-3 text-lg font-semibold text-gray-800">{formatDateTime(reading.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2">AQI breakdown</p>
              <h2 className="text-2xl font-semibold text-gray-900">Ambient pollutant summary</h2>
            </div>
            <span
              className="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: `${aqiCategory?.color ?? '#888'}20`,
                color: aqiCategory?.color ?? '#666',
              }}
            >
              {aqiCategory?.label ?? 'No data'}
            </span>
          </div>

          {pollutantRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-12 text-center text-sm text-gray-400">
              No ambient air parameters were recorded for this report.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-700 text-white text-xs">
                  <th className="px-4 py-3 text-left">Parameter</th>
                  <th className="px-4 py-3 text-left">Measured</th>
                  <th className="px-4 py-3 text-left">Limit</th>
                  <th className="px-4 py-3 text-left">Sub-index</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pollutantRows.map((row, index) => (
                  <tr key={row.key} className={clsx(index % 2 === 1 && 'bg-gray-50')}>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.label}</td>
                    <td className="px-4 py-3 text-gray-600">{row.value} {row.unit}</td>
                    <td className="px-4 py-3 text-gray-500">{row.limit} {row.unit}</td>
                    <td className="px-4 py-3 text-gray-600">{row.subIndex ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={row.breached ? 'badge-violation' : 'badge-compliant'}>
                        {row.breached ? 'Above limit' : 'Within limit'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2">Quick summary</p>
            <h2 className="text-2xl font-semibold text-gray-900">AQI interpretation</h2>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">AQI category</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{reading.aqiCategory ?? recalculated?.category ?? 'No data'}</p>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">Violation flags</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(reading.violatedParameters ?? []).length > 0 ? (
                  (reading.violatedParameters ?? []).map((parameter) => (
                    <span key={parameter} className="badge-violation">
                      {parameter}
                    </span>
                  ))
                ) : (
                  <span className="badge-compliant">No limit breaches</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">Monitoring dates</p>
              <p className="mt-2 text-sm text-gray-600">Monitoring: {formatDateTime(reading.dateOfMonitoring)}</p>
              <p className="mt-1 text-sm text-gray-600">Analysis: {formatDateTime(reading.dateOfAnalysis)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2">Recent trend</p>
              <h2 className="text-2xl font-semibold text-gray-900">Related AQI movement</h2>
            </div>
            <span className="inline-flex items-center gap-2 text-xs text-green-600">
              <Wind size={14} />
              {recentReadings.length} related readings
            </span>
          </div>

          {chartData.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-5 py-12 text-center text-sm text-gray-400">
              No related historical readings available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9edf3" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 14, borderColor: '#dbe4ef' }} />
                <ReferenceLine y={100} stroke="#E67E22" strokeDasharray="4 4" label={{ value: 'AQI 100', fontSize: 10, fill: '#E67E22' }} />
                <Area type="monotone" dataKey="aqi" stroke="#0f766e" fill="url(#aqiFill)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2">Stack emissions</p>
            <h2 className="text-2xl font-semibold text-gray-900">Industrial rows</h2>
          </div>

          {Array.isArray(reading.stackEmissions) && reading.stackEmissions.length > 0 ? (
            <div className="mt-5 space-y-3">
              {reading.stackEmissions.map((row, index) => {
                const particulateMatter = Number(row.particulateMatter)
                const breached = Number.isFinite(particulateMatter) && particulateMatter > 150

                return (
                  <div key={`${row.source}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{row.source || `Stack ${index + 1}`}</p>
                        <p className="text-xs text-gray-400 mt-1">{row.unit || 'mg/Nm3'}</p>
                      </div>
                      <span className={breached ? 'badge-violation' : 'badge-compliant'}>
                        {breached ? 'Above stack limit' : 'Within limit'}
                      </span>
                    </div>
                    <p className="mt-4 text-3xl font-semibold text-gray-900">
                      {row.particulateMatter ?? '-'}
                      <span className="ml-2 text-sm font-medium text-gray-400">{row.unit || 'mg/Nm3'}</span>
                    </p>
                    {row.remark && (
                      <p className="mt-3 text-sm text-gray-500">{row.remark}</p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-gray-200 px-5 py-12 text-center text-sm text-gray-400">
              No stack-emission rows were captured for this report.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
