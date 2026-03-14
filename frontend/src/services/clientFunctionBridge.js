import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { COLLECTIONS } from '../config/constants'
import { getAQICategory } from '../utils/aqiCalculator'
import { sendViolationAlerts } from './emailAlertService'

const BRIDGE_MODE = 'clientOrchestrated'
const BRIDGE_ENABLED = import.meta.env.VITE_USE_CLIENT_FUNCTION_BRIDGE !== 'false'

const AIR_LIMITS = {
  PM10: { limit: 100, unit: 'ug/m3' },
  PM2_5: { limit: 60, unit: 'ug/m3' },
  SO2: { limit: 80, unit: 'ug/m3' },
  NO2: { limit: 80, unit: 'ug/m3' },
  O3: { limit: 100, unit: 'ug/m3' },
  CO_8hr: { limit: 10, unit: 'mg/m3' },
}

const NATURAL_WATER_LIMITS = {
  temperature: { limitMax: 40, unit: 'deg C' },
  pH: { limitMin: 6.5, limitMax: 8.5, unit: '' },
  turbidity: { limitMax: 10, unit: 'NTU' },
  conductivity: { limitMax: 1500, unit: 'uS/cm' },
  totalSolids: { limitMax: 500, unit: 'mg/L' },
  BOD: { limitMax: 3, unit: 'mg/L' },
}

const WASTE_WATER_LIMITS = {
  temperature: { limitMax: 40, unit: 'deg C' },
  pH: { limitMin: 6.5, limitMax: 8.5, unit: '' },
  BOD: { limitMax: 30, unit: 'mg/L' },
  COD: { limitMax: 250, unit: 'mg/L' },
  totalDissolvedSolids: { limitMax: 2100, unit: 'mg/L' },
  totalSuspendedSolids: { limitMax: 100, unit: 'mg/L' },
  oilAndGrease: { limitMax: 10, unit: 'mg/L' },
}

const NOISE_LIMITS = {
  silence: { day: 50, night: 40 },
  residential: { day: 55, night: 45 },
  commercial: { day: 65, night: 55 },
  industrial: { day: 75, night: 70 },
}

function slugifyCity(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getSeverity(violatedParameters) {
  if (!violatedParameters.length) return 'low'

  const maxRatio = violatedParameters.reduce((currentMax, item) => {
    const ratio = item.limit > 0 ? Number(item.measured) / Number(item.limit) : 0
    return Math.max(currentMax, ratio)
  }, 0)

  if (maxRatio >= 1.5) return 'critical'
  if (maxRatio >= 1.2) return 'high'
  return 'medium'
}

function buildAirViolations(reading) {
  const violated = []
  const ambientAir = reading.ambientAir ?? {}

  Object.entries(AIR_LIMITS).forEach(([parameter, config]) => {
    const value = Number(ambientAir[parameter])
    if (Number.isFinite(value) && value > config.limit) {
      violated.push({
        parameter,
        measured: value,
        limit: config.limit,
        unit: config.unit,
      })
    }
  })

  const stackRows = Array.isArray(reading.stackEmissions) ? reading.stackEmissions : []
  stackRows.forEach((row) => {
    const particulateMatter = Number(row.particulateMatter)
    if (Number.isFinite(particulateMatter) && particulateMatter > 150) {
      violated.push({
        parameter: 'PM_Stack',
        measured: particulateMatter,
        limit: 150,
        unit: row.unit || 'mg/Nm3',
      })
    }
  })

  return violated
}

function buildWaterViolations(reading) {
  const limits = reading.waterType === 'waste' ? WASTE_WATER_LIMITS : NATURAL_WATER_LIMITS
  const samples = Array.isArray(reading.samples) ? reading.samples : []
  const byParameter = new Map()

  samples.forEach((sample) => {
    Object.entries(limits).forEach(([parameter, config]) => {
      const value = Number(sample[parameter])
      if (!Number.isFinite(value)) return

      let breach = null
      if (typeof config.limitMax === 'number' && value > config.limitMax) {
        breach = { parameter, measured: value, limit: config.limitMax, unit: config.unit || '' }
      }
      if (typeof config.limitMin === 'number' && value < config.limitMin) {
        breach = { parameter, measured: value, limit: config.limitMin, unit: config.unit || '' }
      }

      if (!breach) return

      const existing = byParameter.get(parameter)
      const breachRatio = breach.limit > 0 ? breach.measured / breach.limit : 0
      const existingRatio = existing && existing.limit > 0 ? existing.measured / existing.limit : 0
      if (!existing || breachRatio > existingRatio) {
        byParameter.set(parameter, breach)
      }
    })
  })

  return Array.from(byParameter.values())
}

function buildNoiseViolations(reading) {
  const rows = Array.isArray(reading.readings) ? reading.readings : []
  const byParameter = new Map()

  rows.forEach((row) => {
    const zone = row.zone || 'industrial'
    const timeKey = row.monitoringTime === 'Night' ? 'night' : 'day'
    const limit = NOISE_LIMITS[zone]?.[timeKey] ?? NOISE_LIMITS.industrial[timeKey]
    const measured = Number(row.noiseLevel)

    if (!Number.isFinite(measured) || measured <= limit) return

    const parameter = `noise_${timeKey}`
    const existing = byParameter.get(parameter)
    if (!existing || measured > existing.measured) {
      byParameter.set(parameter, {
        parameter,
        measured,
        limit,
        unit: 'dB',
        zone,
        monitoringTime: row.monitoringTime || 'Day',
      })
    }
  })

  return Array.from(byParameter.values())
}

function getWaterStatus(summary = {}) {
  const pH = Number(summary.pH)
  const bod = Number(summary.BOD)

  if ((Number.isFinite(pH) && (pH < 6.5 || pH > 8.5)) || (Number.isFinite(bod) && bod > 30)) return 'violation'
  if ((Number.isFinite(pH) && (pH < 6.8 || pH > 8.2)) || (Number.isFinite(bod) && bod > 15)) return 'poor'
  if ((Number.isFinite(pH) && (pH < 7.0 || pH > 8.0)) || (Number.isFinite(bod) && bod > 6)) return 'moderate'
  return 'good'
}

function getNoiseStatus(level) {
  if (!Number.isFinite(level)) return 'good'
  if (level > 75) return 'violation'
  if (level > 65) return 'poor'
  if (level > 55) return 'moderate'
  return 'good'
}

async function getLocationContext(locationId) {
  if (!locationId) return null
  const snap = await getDoc(doc(db, COLLECTIONS.MONITORING_LOCATIONS, locationId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

async function getRegionalOfficeContext(roId) {
  if (!roId) return null
  const snap = await getDoc(doc(db, COLLECTIONS.REGIONAL_OFFICES, roId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

async function getIndustryContext(industryId) {
  if (!industryId) return null
  const snap = await getDoc(doc(db, COLLECTIONS.INDUSTRIES, industryId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

async function getSuperAdminRecipient() {
  const envEmail = import.meta.env.VITE_ALERT_ADMIN_EMAIL || import.meta.env.VITE_SUPER_ADMIN_EMAIL
  if (envEmail) return envEmail

  try {
    const userQuery = query(
      collection(db, COLLECTIONS.USERS),
      where('role', '==', 'superAdmin'),
      limit(1)
    )
    const snapshot = await getDocs(userQuery)
    if (snapshot.empty) return null
    return snapshot.docs[0].data()?.email ?? null
  } catch (error) {
    console.warn('Unable to resolve super admin email for alerts:', error)
    return null
  }
}

async function incrementCityViolationCount(cityId) {
  const summaryRef = doc(db, COLLECTIONS.PUBLIC_SUMMARY, cityId)
  const summarySnap = await getDoc(summaryRef)
  const current = summarySnap.exists() ? summarySnap.data() : {}
  return Number(current.activeViolations ?? 0) + 1
}

async function updateIndustryCompliance(industryId, nextStatus) {
  if (!industryId) return
  await updateDoc(doc(db, COLLECTIONS.INDUSTRIES, industryId), {
    complianceStatus: nextStatus,
    bridgeMode: BRIDGE_MODE,
    updatedAt: serverTimestamp(),
  })
}

async function syncPublicSummary({ cityId, cityName, readingType, reading, isViolation }) {
  if (!cityId) return

  const payload = {
    cityId,
    cityName,
    bridgeMode: BRIDGE_MODE,
    updatedAt: serverTimestamp(),
  }

  if (readingType === 'air') {
    payload.aqi = reading.aqi ?? null
    payload.aqiCategory = getAQICategory(reading.aqi ?? 0)?.label ?? reading.aqiCategory ?? 'No data'
  }

  if (readingType === 'water') {
    payload.waterQualityStatus = isViolation ? 'unsafe' : getWaterStatus(reading.summary) === 'good' ? 'safe' : 'caution'
  }

  if (readingType === 'noise') {
    payload.noiseLevelDayAvg = reading.averageNoiseLevel ?? reading.noiseLevel ?? null
  }

  if (isViolation) {
    payload.activeViolations = await incrementCityViolationCount(cityId)
  }

  await setDoc(doc(db, COLLECTIONS.PUBLIC_SUMMARY, cityId), payload, { merge: true })
}

async function updateLocationSummary({ readingType, reading, location }) {
  if (!location?.id) return

  const locationRef = doc(db, COLLECTIONS.MONITORING_LOCATIONS, location.id)
  const basePayload = {
    bridgeMode: BRIDGE_MODE,
    lastUpdated: serverTimestamp(),
  }

  if (readingType === 'air') {
    const aqiCategory = getAQICategory(reading.aqi ?? 0)
    await setDoc(locationRef, {
      ...basePayload,
      currentStatus: reading.isViolation ? 'violation' : (reading.aqi ?? 0) > 200 ? 'poor' : (reading.aqi ?? 0) > 100 ? 'moderate' : 'good',
      latestAQI: reading.aqi ?? null,
      latestAQICategory: aqiCategory?.label ?? reading.aqiCategory ?? null,
      latestAmbientAir: reading.ambientAir ?? null,
    }, { merge: true })
    return
  }

  if (readingType === 'water') {
    await setDoc(locationRef, {
      ...basePayload,
      currentStatus: reading.isViolation ? 'violation' : getWaterStatus(reading.summary),
      latestWater: {
        waterType: reading.waterType || 'natural',
        pH: reading.summary?.pH ?? null,
        BOD: reading.summary?.BOD ?? null,
        COD: reading.summary?.COD ?? null,
        sampleCount: reading.sampleCount ?? null,
        isViolation: Boolean(reading.isViolation),
      },
    }, { merge: true })
    return
  }

  await setDoc(locationRef, {
    ...basePayload,
    currentStatus: reading.isViolation ? 'violation' : getNoiseStatus(Number(reading.noiseLevel)),
    latestNoiseLevel: Number.isFinite(Number(reading.noiseLevel)) ? Number(reading.noiseLevel) : null,
    latestNoiseSummary: {
      averageNoiseLevel: Number.isFinite(Number(reading.averageNoiseLevel)) ? Number(reading.averageNoiseLevel) : null,
      peakNoiseLevel: Number.isFinite(Number(reading.peakNoiseLevel ?? reading.noiseLevel)) ? Number(reading.peakNoiseLevel ?? reading.noiseLevel) : null,
      monitoringTime: reading.monitoringTime || 'Day',
      zone: reading.zone || 'industrial',
      readingCount: reading.readingCount ?? null,
      isViolation: Boolean(reading.isViolation),
    },
  }, { merge: true })
}

async function createComplianceArtifacts({ readingType, readingId, reading, violatedParameters, cityId, cityName }) {
  if (!violatedParameters.length) return

  const severity = getSeverity(violatedParameters)
  const violationId = `temp_${readingType}_${readingId}`
  const escalationId = `temp_escalation_${readingType}_${readingId}`
  const notificationId = `temp_notification_${readingType}_${readingId}`

  const batch = writeBatch(db)

  batch.set(doc(db, COLLECTIONS.VIOLATIONS, violationId), {
    bridgeMode: BRIDGE_MODE,
    readingId,
    readingType,
    roId: reading.roId || null,
    roName: reading.roName || null,
    industryId: reading.industryId || null,
    industryName: reading.industryName || 'Unknown Source',
    locationId: reading.locationId || null,
    cityId,
    cityName,
    violatedParameters,
    severity,
    status: 'open',
    source: reading.isSimulated ? 'iot' : 'manual',
    detectedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  batch.set(doc(db, COLLECTIONS.ESCALATIONS, escalationId), {
    bridgeMode: BRIDGE_MODE,
    violationId,
    readingId,
    industryId: reading.industryId || null,
    industryName: reading.industryName || 'Unknown Source',
    roId: reading.roId || null,
    roName: reading.roName || null,
    status: 'PENDING',
    severity,
    notes: '',
    inspectionDate: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  batch.set(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), {
    bridgeMode: BRIDGE_MODE,
    type: 'violation',
    title: `Violation detected: ${reading.industryName || 'Industry'}`,
    body: violatedParameters.map((item) => `${item.parameter} exceeded limit`).join(', '),
    violationId,
    recipientRoId: reading.roId || null,
    recipientUid: null,
    severity,
    isRead: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true })

  await batch.commit()
}

export async function orchestrateReadingSubmission({ readingType, readingId, reading }) {
  if (!BRIDGE_ENABLED) return

  try {
    const [location, regionalOffice, industry, superAdminEmail] = await Promise.all([
      getLocationContext(reading.locationId),
      getRegionalOfficeContext(reading.roId),
      getIndustryContext(reading.industryId),
      getSuperAdminRecipient(),
    ])
    const cityName = location?.city || reading.cityName || reading.roName || 'Unknown City'
    const cityId = slugifyCity(cityName)

    let violatedParameters = []
    if (readingType === 'air') violatedParameters = buildAirViolations(reading)
    if (readingType === 'water') violatedParameters = buildWaterViolations(reading)
    if (readingType === 'noise') violatedParameters = buildNoiseViolations(reading)

    await updateLocationSummary({ readingType, reading, location })
    await syncPublicSummary({
      cityId,
      cityName,
      readingType,
      reading,
      isViolation: violatedParameters.length > 0,
    })
    await updateIndustryCompliance(reading.industryId, violatedParameters.length ? 'violation' : 'compliant')
    await createComplianceArtifacts({
      readingType,
      readingId,
      reading,
      violatedParameters,
      cityId,
      cityName,
    })

    if (violatedParameters.length > 0) {
      const primaryViolation = violatedParameters[0]
      await sendViolationAlerts({
        industryName: reading.industryName || industry?.name || 'Industry',
        parameter: primaryViolation.parameter,
        value: primaryViolation.measured,
        limit: primaryViolation.limit,
        roEmail: regionalOffice?.email || reading.roEmail || null,
        superAdminEmail,
      })
    }
  } catch (error) {
    console.error('Client function bridge failed:', error)
  }
}

export { BRIDGE_ENABLED, BRIDGE_MODE }
