import { useState } from 'react'
import useForecastEngine from '../../hooks/useForecastEngine'
import ForecastAreaChart from '../../components/charts/ForecastAreaChart'
import ForecastTable from '../../components/charts/ForecastTable'

const LOCATION_OPTIONS = [
  { value: 'LOC001', label: 'Urla Industrial Area — Raipur' },
  { value: 'LOC002', label: 'Siltara Growth Centre — Raipur' },
  { value: 'LOC003', label: 'Sheonath River — Raipur' },
  { value: 'LOC005', label: 'Lailunga Industrial Stack — Raigarh' },
  { value: 'LOC009', label: 'Sirgitti Industrial Area — Bilaspur' },
  { value: 'LOC013', label: 'Bhilai Steel Plant — Durg' },
  { value: 'LOC017', label: 'NTPC Korba Thermal — Korba' },
  { value: 'LOC021', label: 'Indravati River — Jagdalpur' },
]

const PARAMETER_OPTIONS = [
  { value: 'SO2', label: 'SO₂' },
  { value: 'PM10', label: 'PM₁₀' },
  { value: 'PM2_5', label: 'PM₂.₅' },
  { value: 'NO2', label: 'NO₂' },
]

const PARAMETER_LABELS = {
  SO2: 'SO₂',
  PM10: 'PM₁₀',
  PM2_5: 'PM₂.₅',
  NO2: 'NO₂',
}

const PARAMETER_UNITS = {
  SO2: 'µg/m³',
  PM10: 'µg/m³',
  PM2_5: 'µg/m³',
  NO2: 'µg/m³',
}

export default function ForecastPage() {
  const [selectedLocation, setSelectedLocation] = useState('LOC001')
  const [selectedParameter, setSelectedParameter] = useState('SO2')

  const { forecastData, loading, error, lastComputed, recompute } = useForecastEngine(
    selectedLocation,
    selectedParameter,
    'air'
  )

  const parameterLabel = PARAMETER_LABELS[selectedParameter] ?? selectedParameter
  const unit = PARAMETER_UNITS[selectedParameter] ?? 'µg/m³'
  const selectedLocationLabel = LOCATION_OPTIONS.find((item) => item.value === selectedLocation)?.label ?? selectedLocation

  return (
    <div className="space-y-6">
      <section className="card !p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-primary-800 via-primary-700 to-eco-700 px-6 py-7 text-white">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-white/65 mb-2">
                Forecast intelligence
              </p>
              <h1 className="text-3xl font-semibold text-white">
                Predictive Pollution Forecast
              </h1>
              <p className="text-sm text-white/75 mt-2">
                7-day projection using smoothed historical readings and linear trend analysis.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Location</p>
                <p className="mt-2 text-sm font-semibold text-white">{selectedLocation}</p>
                <p className="mt-1 text-xs text-white/70">{selectedLocationLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Parameter</p>
                <p className="mt-2 text-sm font-semibold text-white">{parameterLabel}</p>
                <p className="mt-1 text-xs text-white/70">{unit}</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/60">Status</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {forecastData?.predictedViolation ? 'Violation expected' : 'Within trend band'}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {forecastData ? 'Updated from live forecast engine' : 'Awaiting forecast output'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,320px)_minmax(0,190px)]">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-gray-500">
                Monitoring Location
              </label>
              <select
                value={selectedLocation}
                onChange={(event) => setSelectedLocation(event.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {LOCATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-gray-500">
                Parameter
              </label>
              <select
                value={selectedParameter}
                onChange={(event) => setSelectedParameter(event.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PARAMETER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <button
              type="button"
              onClick={recompute}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Computing...' : 'Refresh Forecast'}
            </button>

            {lastComputed && (
              <p className="text-xs text-gray-400">
                {`Computed at ${lastComputed.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
              </p>
            )}
          </div>
        </div>
      </section>

      {forecastData?.predictedViolation && (
        <section className="alert-solid-warning">
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none">⚠️</span>
            <div>
              <h2 className="font-medium text-white">Predicted Violation Detected</h2>
              <p className="text-sm text-white/85 mt-1">
                {`${parameterLabel} at this location is forecast to exceed the prescribed limit of ${forecastData.prescribedLimit} ${unit} within the next 7 days. Pre-emptive inspection is recommended.`}
              </p>
            </div>
          </div>
        </section>
      )}

      {error && (
        <section className="alert-solid-error text-sm">
          {error}
        </section>
      )}

      {loading && (
        <section>
          <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse mt-6" />
        </section>
      )}

      {forecastData && !loading && (
        <>
          <ForecastAreaChart
            historicalValues={forecastData.historicalValues}
            forecastValues={forecastData.forecastValues}
            prescribedLimit={forecastData.prescribedLimit}
            parameter={selectedParameter}
          />

          <ForecastTable
            forecastValues={forecastData.forecastValues}
            prescribedLimit={forecastData.prescribedLimit}
            parameter={selectedParameter}
          />
        </>
      )}

      <section className="alert-solid-info text-sm">
        <div className="flex items-start gap-3">
          <span className="text-base leading-none">ℹ️</span>
          <p className="text-white/85">
            Forecast Methodology: This forecast applies a 7-day Simple Moving Average
            to smooth historical readings, then fits a linear regression to project
            the trend 7 days forward. Results are indicative — field inspection
            remains the authoritative source of compliance status.
          </p>
        </div>
      </section>
    </div>
  )
}
