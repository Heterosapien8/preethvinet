import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Play, Square, Zap } from 'lucide-react'
import clsx from 'clsx'
import { useSensorSimulation } from '../../contexts/SensorSimulationContext'
import { useAuth } from '../../contexts/AuthContext'
import { ROLES } from '../../config/constants'

const MANUAL_SPIKE_OPTIONS = [
  { value: 'SO2', label: 'SO2' },
  { value: 'PM10', label: 'PM10' },
  { value: 'PM2_5', label: 'PM2.5' },
  { value: 'NO2', label: 'NO2' },
  { value: 'pH', label: 'pH' },
  { value: 'BOD', label: 'BOD' },
  { value: 'noise_day', label: 'dB (Day)' },
]

function formatSecondsAgo(value) {
  if (!value) return 'No ticks yet'
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000))
  if (seconds < 60) return `${seconds} seconds ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
}

export default function SensorControlPanel() {
  const { role } = useAuth()
  const {
    isRunning,
    tickCount,
    lastTickAt,
    locationsLoaded,
    locations,
    intervalMs,
    start,
    stop,
    triggerManualSpike,
  } = useSensorSimulation()
  const [expanded, setExpanded] = useState(true)
  const [relativeLastTick, setRelativeLastTick] = useState(formatSecondsAgo(lastTickAt))
  const [form, setForm] = useState({ locationId: '', parameter: 'SO2' })
  const [spiking, setSpiking] = useState(false)

  useEffect(() => {
    setRelativeLastTick(formatSecondsAgo(lastTickAt))
    const timer = window.setInterval(() => {
      setRelativeLastTick(formatSecondsAgo(lastTickAt))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [lastTickAt])

  useEffect(() => {
    if (!form.locationId && locations.length > 0) {
      setForm((current) => ({ ...current, locationId: locations[0].id }))
    }
  }, [form.locationId, locations])

  const intervalLabel = useMemo(() => `${Math.round(intervalMs / 60000)} min`, [intervalMs])

  if (role !== ROLES.SUPER_ADMIN) return null

  return (
    <section className="card border border-primary-100">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-4"
      >
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-gray-400 mb-2">
            IoT Simulation Control
          </p>
          <h2 className="text-2xl font-semibold text-gray-900">
            Sensor Simulation Service
          </h2>
        </div>
        <ChevronDown
          size={18}
          className={clsx('text-gray-400 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-400 mb-2">Status</p>
              <span className={clsx(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                isRunning ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
              )}>
                <span className={clsx('h-2.5 w-2.5 rounded-full', isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500')} />
                {isRunning ? 'SIMULATING' : 'STOPPED'}
              </span>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-400 mb-2">Readings Sent</p>
              <p className="text-2xl font-semibold text-gray-900">{tickCount * Math.max(locationsLoaded, 0)}</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-400 mb-2">Last Update</p>
              <p className="text-sm font-semibold text-gray-900">{relativeLastTick}</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-400 mb-2">Stations Online</p>
              <p className="text-sm font-semibold text-gray-900">{locationsLoaded} stations · interval {intervalLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => start()}
              disabled={isRunning}
              className="btn-primary flex items-center gap-2"
            >
              <Play size={16} />
              Start Simulation
            </button>
            <button
              type="button"
              onClick={stop}
              disabled={!isRunning}
              className="btn-secondary flex items-center gap-2"
            >
              <Square size={16} />
              Stop Simulation
            </button>
          </div>

          <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Zap size={16} className="text-primary-700" />
              <p className="text-sm font-semibold text-primary-800">Trigger Spike Now</p>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
              <select
                value={form.locationId}
                onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))}
                className="input-base"
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>

              <select
                value={form.parameter}
                onChange={(event) => setForm((current) => ({ ...current, parameter: event.target.value }))}
                className="input-base"
              >
                {MANUAL_SPIKE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <button
                type="button"
                disabled={!form.locationId || spiking}
                onClick={async () => {
                  setSpiking(true)
                  try {
                    await triggerManualSpike(form.locationId, form.parameter)
                  } finally {
                    setSpiking(false)
                  }
                }}
                className="btn-primary whitespace-nowrap"
              >
                {spiking ? 'Injecting...' : 'Trigger Spike'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
