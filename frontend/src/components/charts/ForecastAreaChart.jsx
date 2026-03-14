import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PARAMETER_LABELS = {
  SO2: 'SO₂',
  PM10: 'PM₁₀',
  PM2_5: 'PM₂.₅',
  NO2: 'NO₂',
  pH: 'pH',
  BOD: 'BOD',
}

const PARAMETER_UNITS = {
  SO2: 'µg/m³',
  PM10: 'µg/m³',
  PM2_5: 'µg/m³',
  NO2: 'µg/m³',
  pH: '(pH units)',
  BOD: 'mg/L',
}

function parseDateKey(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function formatAxisDate(value) {
  const parsed = parseDateKey(value)
  if (!parsed || Number.isNaN(parsed.getTime())) return value
  return format(parsed, 'MMM dd')
}

export default function ForecastAreaChart({
  historicalValues,
  forecastValues,
  prescribedLimit,
  parameter,
}) {
  const unit = PARAMETER_UNITS[parameter] ?? 'µg/m³'
  const label = PARAMETER_LABELS[parameter] ?? parameter
  const chartData = [
    ...historicalValues.map((item) => ({
      date: item.date,
      historical: item.value,
      forecast: null,
    })),
    ...forecastValues.map((item) => ({
      date: item.date,
      historical: null,
      forecast: item.value,
    })),
  ]

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-gray-800">Pollution Trend & Forecast</h2>
        <p className="text-xs text-gray-400">
          Solid line = historical data • Dashed line = projected trend
        </p>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={formatAxisDate}
          />
          <YAxis tick={{ fontSize: 11 }} unit={unit === '(pH units)' ? '' : ` ${unit}`} />
          <Tooltip
            labelFormatter={(value) => formatAxisDate(value)}
            formatter={(value) => [
              value === null || value === undefined ? '-' : `${value} ${unit}`,
              label,
            ]}
            contentStyle={{
              borderRadius: 14,
              borderColor: '#e5e7eb',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={prescribedLimit}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{
              value: `Limit: ${prescribedLimit}`,
              fill: '#ef4444',
              fontSize: 11,
            }}
          />
          <Area
            type="monotone"
            dataKey="historical"
            stroke="#3b82f6"
            fill="#bfdbfe"
            strokeWidth={2}
            connectNulls={false}
            name="Historical"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke="#f97316"
            fill="#fed7aa"
            strokeWidth={2}
            strokeDasharray="6 3"
            connectNulls={false}
            name="7-Day Forecast"
            dot={{ fill: '#f97316', r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  )
}
