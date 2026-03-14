import { format } from 'date-fns'
import clsx from 'clsx'

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

function getStatusConfig(value, prescribedLimit) {
  if (value <= prescribedLimit * 0.75) {
    return { label: 'Safe', className: 'bg-green-100 text-green-700' }
  }

  if (value <= prescribedLimit * 0.9) {
    return { label: 'Watch', className: 'bg-yellow-100 text-yellow-700' }
  }

  if (value <= prescribedLimit) {
    return { label: 'Warning', className: 'bg-orange-100 text-orange-700' }
  }

  return { label: 'Violation', className: 'bg-red-100 text-red-700' }
}

export default function ForecastTable({ forecastValues, prescribedLimit, parameter }) {
  const unit = PARAMETER_UNITS[parameter] ?? 'µg/m³'

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="px-6 pt-6">
        <h2 className="text-lg font-semibold text-gray-800">7-Day Forecast Summary</h2>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-6 py-3 text-left">Day</th>
              <th className="px-6 py-3 text-left">Date</th>
              <th className="px-6 py-3 text-left">Predicted</th>
              <th className="px-6 py-3 text-left">vs Limit</th>
              <th className="px-6 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {forecastValues.map((item, index) => {
              const status = getStatusConfig(item.value, prescribedLimit)
              const percentage = Math.round((item.value / prescribedLimit) * 100)
              const displayDate = parseDateKey(item.date)

              return (
                <tr
                  key={item.date}
                  className={clsx(
                    item.isAboveLimit ? 'bg-red-50' : 'bg-white hover:bg-gray-50'
                  )}
                >
                  <td className="px-6 py-4 font-medium text-gray-700">{`Day ${index + 1}`}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {displayDate ? format(displayDate, 'EEE, MMM d') : item.date}
                  </td>
                  <td className="px-6 py-4 text-gray-700">{`${item.value} ${unit}`}</td>
                  <td
                    className={clsx(
                      'px-6 py-4',
                      item.isAboveLimit ? 'text-red-600 font-medium' : 'text-gray-500'
                    )}
                  >
                    {`${percentage}% of limit`}
                  </td>
                  <td className="px-6 py-4">
                    <span className={clsx('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', status.className)}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
