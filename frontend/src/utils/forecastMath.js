/**
 * Round a numeric value to a fixed precision.
 * @param {number} value
 * @param {number} decimals
 * @returns {number}
 */
function roundTo(value, decimals) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Convert a supported timestamp shape into a Date instance.
 * @param {Date|{toDate?: Function}|string|number} input
 * @returns {Date|null}
 */
function toDate(input) {
  if (!input) return null
  if (input instanceof Date) return input
  if (typeof input?.toDate === 'function') return input.toDate()

  const parsed = new Date(input)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Format a date as YYYY-MM-DD using local calendar values.
 * @param {Date} date
 * @returns {string}
 */
function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Group raw readings by calendar day and return rounded daily averages.
 * @param {Array<{createdAt: Date|{toDate?: Function}|string|number, value: number}>} readings
 * @returns {Array<{date: string, value: number}>}
 */
export function aggregateToDailyAverages(readings) {
  const grouped = new Map()

  readings.forEach((reading) => {
    const date = toDate(reading?.createdAt)
    const value = Number(reading?.value)

    if (!date || !Number.isFinite(value)) return

    const key = formatDateKey(date)
    const bucket = grouped.get(key) ?? { sum: 0, count: 0 }
    bucket.sum += value
    bucket.count += 1
    grouped.set(key, bucket)
  })

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, bucket]) => ({
      date,
      value: roundTo(bucket.sum / bucket.count, 1),
    }))
}

/**
 * Apply a simple moving average across a series of numeric values.
 * @param {number[]} values
 * @param {number} [window=7]
 * @returns {number[]}
 */
export function applySMA(values, window = 7) {
  if (!Array.isArray(values) || values.length < window || window < 1) {
    return []
  }

  const smoothed = []

  for (let end = window - 1; end < values.length; end += 1) {
    const slice = values.slice(end - window + 1, end + 1)
    const average = slice.reduce((sum, value) => sum + Number(value || 0), 0) / window
    smoothed.push(roundTo(average, 1))
  }

  return smoothed
}

/**
 * Fit a least-squares linear regression line to indexed values.
 * @param {number[]} values
 * @returns {{slope: number, intercept: number}}
 */
export function linearRegression(values) {
  if (!Array.isArray(values) || values.length < 2) {
    return {
      slope: 0,
      intercept: roundTo(Number(values?.[0] ?? 0), 1),
    }
  }

  const n = values.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  values.forEach((value, index) => {
    sumX += index
    sumY += value
    sumXY += index * value
    sumXX += index * index
  })

  const denominator = (n * sumXX) - (sumX * sumX)
  const slope = denominator === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / denominator
  const intercept = (sumY - (slope * sumX)) / n

  return {
    slope: roundTo(slope, 3),
    intercept: roundTo(intercept, 1),
  }
}

/**
 * Project forward values from a regression line and evaluate prescribed limits.
 * @param {number[]} smoothedValues
 * @param {number} slope
 * @param {number} intercept
 * @param {number} [days=7]
 * @param {number} prescribedLimit
 * @returns {Array<{date: string, value: number, isAboveLimit: boolean}>}
 */
export function projectForecast(
  smoothedValues,
  slope,
  intercept,
  days = 7,
  prescribedLimit
) {
  const lastIndex = Array.isArray(smoothedValues) ? smoothedValues.length - 1 : -1
  const today = new Date()
  const projected = []

  for (let index = 0; index < days; index += 1) {
    const x = lastIndex + index + 1
    const raw = (slope * x) + intercept
    const value = Math.max(0, roundTo(raw, 1))
    const date = new Date(today)
    date.setDate(today.getDate() + index + 1)

    projected.push({
      date: formatDateKey(date),
      value,
      isAboveLimit: value > prescribedLimit,
    })
  }

  return projected
}

/**
 * Run the full forecast pipeline from raw readings to a 7-day projection.
 * @param {Array<{createdAt: Date|{toDate?: Function}|string|number, value: number}>} rawReadings
 * @param {number} prescribedLimit
 * @returns {null|{historicalValues: Array<{date: string, value: number}>, forecastValues: Array<{date: string, value: number, isAboveLimit: boolean}>, predictedViolation: boolean, slope: number, intercept: number, generatedAt: string}}
 */
export function runForecastPipeline(rawReadings, prescribedLimit) {
  const dailyAvgs = aggregateToDailyAverages(rawReadings)
  if (dailyAvgs.length < 7) return null

  const smoothed = applySMA(dailyAvgs.map((item) => item.value), 7)
  if (smoothed.length < 2) return null

  const { slope, intercept } = linearRegression(smoothed)
  const forecastValues = projectForecast(smoothed, slope, intercept, 7, prescribedLimit)
  const predictedViolation = forecastValues.some((item) => item.isAboveLimit)

  return {
    historicalValues: dailyAvgs.slice(-14),
    forecastValues,
    predictedViolation,
    slope,
    intercept,
    generatedAt: new Date().toISOString(),
  }
}
