import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import { COLLECTIONS } from '../../config/constants'
import { calculateAQI } from '../../utils/aqiCalculator'
import { orchestrateReadingSubmission } from '../clientFunctionBridge'

const DEFAULT_INTERVAL_MS = Number(import.meta.env.VITE_SENSOR_SIM_INTERVAL_MS || 600000)
const DEMO_INTERVAL_MS = 45000
const SPIKE_TICK_MOD = 10

const AIR_PARAMETER_KEYS = ['PM10', 'PM2_5', 'SO2', 'NO2', 'O3', 'CO_8hr']
const NATURAL_WATER_KEYS = ['temperature', 'pH', 'turbidity', 'conductivity', 'totalSolids', 'BOD']
const WASTE_WATER_KEYS = ['temperature', 'pH', 'BOD', 'COD', 'totalDissolvedSolids', 'totalSuspendedSolids', 'oilAndGrease']

function randomDrift() {
  return (Math.random() * 0.16) - 0.08
}

function clamp(value, baseline) {
  const safeBaseline = Math.max(Number(baseline) || 1, 0.01)
  const floor = safeBaseline * 0.1
  const ceiling = safeBaseline * 3
  return Math.min(Math.max(value, floor), ceiling)
}

function withRandomWalk(current, baseline) {
  const base = Number(baseline) || Number(current) || 1
  const previous = Number(current) || base
  const next = previous * (1 + randomDrift())
  return Number(clamp(next, base).toFixed(2))
}

function mapLocationType(location) {
  if (location.type === 'noise') return 'noise'
  if (location.type === 'water') return 'water'
  return 'air'
}

function inferNoiseZone(locationName = '') {
  const label = locationName.toLowerCase()
  if (label.includes('silence')) return 'silence'
  if (label.includes('residential')) return 'residential'
  if (label.includes('commercial') || label.includes('market')) return 'commercial'
  return 'industrial'
}

function inferWaterType(locationName = '') {
  const label = locationName.toLowerCase()
  if (label.includes('effluent') || label.includes('etp') || label.includes('outlet') || label.includes('waste')) {
    return 'waste'
  }
  return 'natural'
}

function getTimestampLabel() {
  return new Date().toLocaleString('en-IN')
}

function buildAirBaseline(location) {
  const source = location.baselineValues ?? {}
  return {
    PM10: Number(source.PM10) || 60,
    PM2_5: Number(source.PM2_5) || 35,
    SO2: Number(source.SO2) || 40,
    NO2: Number(source.NO2) || 40,
    O3: Number(source.O3) || 80,
    CO_8hr: Number(source.CO_8hr) || 1.5,
  }
}

function buildWaterBaseline(location, waterType) {
  const source = location.baselineValues ?? {}
  if (waterType === 'waste') {
    return {
      temperature: Number(source.temperature) || 30,
      pH: Number(source.pH) || 7.2,
      BOD: Number(source.BOD) || 18,
      COD: Number(source.COD) || 120,
      totalDissolvedSolids: Number(source.totalDissolvedSolids) || 900,
      totalSuspendedSolids: Number(source.totalSuspendedSolids) || 70,
      oilAndGrease: Number(source.oilAndGrease) || 5,
    }
  }

  return {
    temperature: Number(source.temperature) || 27,
    pH: Number(source.pH) || 7.1,
    turbidity: Number(source.turbidity) || 6,
    conductivity: Number(source.conductivity) || 700,
    totalSolids: Number(source.totalSolids) || 250,
    BOD: Number(source.BOD) || 2.4,
  }
}

function buildNoiseBaseline(location) {
  const source = location.baselineValues ?? {}
  return {
    day: Number(source.noiseDay) || 58,
    night: Number(source.noiseNight) || 48,
  }
}

function buildPrescribedLimitLookup(limitDocs) {
  const lookup = {
    air: {
      PM10: 100,
      PM2_5: 60,
      SO2: 80,
      NO2: 80,
      O3: 100,
      CO_8hr: 10,
    },
    water: {
      natural: {
        temperature: { max: 40 },
        pH: { min: 6.5, max: 8.5 },
        turbidity: { max: 10 },
        conductivity: { max: 1500 },
        totalSolids: { max: 500 },
        BOD: { max: 3 },
      },
      waste: {
        temperature: { max: 40 },
        pH: { min: 6.5, max: 8.5 },
        BOD: { max: 30 },
        COD: { max: 250 },
        totalDissolvedSolids: { max: 2100 },
        totalSuspendedSolids: { max: 100 },
        oilAndGrease: { max: 10 },
      },
    },
    noise: {
      silence: { day: 50, night: 40 },
      residential: { day: 55, night: 45 },
      commercial: { day: 65, night: 55 },
      industrial: { day: 75, night: 70 },
    },
  }

  limitDocs.forEach((docItem) => {
    if (docItem.department === 'air' && typeof docItem.limitMax === 'number') {
      lookup.air[docItem.parameter] = docItem.limitMax
    }

    if (docItem.department === 'water') {
      const target = docItem.parameter === 'COD' || docItem.parameter === 'totalDissolvedSolids' || docItem.parameter === 'totalSuspendedSolids' || docItem.parameter === 'oilAndGrease'
        ? lookup.water.waste
        : lookup.water.natural

      target[docItem.parameter] = {
        min: typeof docItem.limitMin === 'number' ? docItem.limitMin : undefined,
        max: typeof docItem.limitMax === 'number' ? docItem.limitMax : undefined,
      }
    }

    if (docItem.department === 'noise' && docItem.zoneBasedLimits) {
      lookup.noise = docItem.zoneBasedLimits
    }
  })

  return lookup
}

class SensorSimulationService {
  constructor() {
    this.intervalId = null
    this.listeners = new Set()
    this.locations = []
    this.prescribedLimits = null
    this.currentValues = new Map()
    this.state = {
      isRunning: false,
      tickCount: 0,
      lastTickAt: null,
      locationsLoaded: 0,
      intervalMs: DEFAULT_INTERVAL_MS,
      locations: [],
    }
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  getState() {
    return { ...this.state }
  }

  emit() {
    const snapshot = this.getState()
    this.listeners.forEach((listener) => listener(snapshot))
  }

  async primeCaches() {
    if (!this.locations.length) {
      const locationSnapshot = await getDocs(query(
        collection(db, COLLECTIONS.MONITORING_LOCATIONS),
        orderBy('name')
      ))

      this.locations = locationSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
    }

    if (!this.prescribedLimits) {
      const limitSnapshot = await getDocs(query(
        collection(db, COLLECTIONS.PRESCRIBED_LIMITS),
        orderBy('parameter')
      ))
      const limitDocs = limitSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))
      this.prescribedLimits = buildPrescribedLimitLookup(limitDocs)
    }

    if (!this.currentValues.size) {
      this.locations.forEach((location) => {
        const simulationType = mapLocationType(location)
        if (simulationType === 'air') {
          this.currentValues.set(location.id, {
            type: 'air',
            values: buildAirBaseline(location),
          })
        } else if (simulationType === 'water') {
          const waterType = inferWaterType(location.name)
          this.currentValues.set(location.id, {
            type: 'water',
            waterType,
            values: buildWaterBaseline(location, waterType),
          })
        } else {
          this.currentValues.set(location.id, {
            type: 'noise',
            zone: inferNoiseZone(location.name),
            values: buildNoiseBaseline(location),
          })
        }
      })
    }

    this.state.locationsLoaded = this.locations.length
    this.state.locations = this.locations.map((location) => ({
      id: location.id,
      name: location.name,
      type: mapLocationType(location),
    }))
    this.emit()
  }

  async start(options = {}) {
    if (this.intervalId) return this.getState()

    await this.primeCaches()
    const intervalMs = Number(options.intervalMs) || DEFAULT_INTERVAL_MS
    this.state.intervalMs = intervalMs
    this.state.isRunning = true
    this.emit()

    this.intervalId = window.setInterval(async () => {
      try {
        await this.runTick()
      } catch (error) {
        console.error('Sensor simulation tick failed:', error)
      }
    }, intervalMs)

    return this.getState()
  }

  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.state.isRunning = false
    this.state.tickCount = 0
    this.state.lastTickAt = null
    this.emit()
  }

  async runTick() {
    if (!this.locations.length) {
      await this.primeCaches()
    }

    this.state.tickCount += 1
    this.state.lastTickAt = Date.now()
    this.emit()

    let spikePlan = null
    if (this.state.tickCount % SPIKE_TICK_MOD === 0) {
      spikePlan = this.selectRandomSpikePlan()
    }

    for (const location of this.locations) {
      const manualSpike = spikePlan?.locationId === location.id ? spikePlan.parameter : null
      await this.writeSimulatedReading(location, manualSpike)
    }
  }

  selectRandomSpikePlan() {
    if (!this.locations.length) return null
    const location = this.locations[Math.floor(Math.random() * this.locations.length)]
    const simulationType = mapLocationType(location)

    if (simulationType === 'air') {
      const parameter = AIR_PARAMETER_KEYS[Math.floor(Math.random() * 4)]
      return { locationId: location.id, parameter }
    }

    if (simulationType === 'water') {
      const waterType = inferWaterType(location.name)
      const keys = waterType === 'waste'
        ? ['BOD', 'COD', 'oilAndGrease']
        : ['BOD', 'turbidity', 'pH']
      return { locationId: location.id, parameter: keys[Math.floor(Math.random() * keys.length)] }
    }

    return {
      locationId: location.id,
      parameter: Math.random() > 0.5 ? 'noise_day' : 'noise_night',
    }
  }

  async triggerManualSpike(locationId, parameter) {
    const location = this.locations.find((item) => item.id === locationId)
    if (!location) {
      throw new Error(`Unknown monitoring location: ${locationId}`)
    }

    return this.writeSimulatedReading(location, parameter)
  }

  applySpike(entry, parameter) {
    if (!parameter) return

    if (entry.type === 'air') {
      const limit = this.prescribedLimits?.air?.[parameter]
      if (typeof limit === 'number') {
        entry.values[parameter] = Number((limit * (1.2 + (Math.random() * 0.2))).toFixed(2))
      }
      return
    }

    if (entry.type === 'water') {
      const waterType = entry.waterType
      if (parameter === 'pH') {
        entry.values.pH = Math.random() > 0.5 ? 9.2 : 5.9
        return
      }

      const bounds = this.prescribedLimits?.water?.[waterType]?.[parameter]
      if (bounds?.max) {
        entry.values[parameter] = Number((bounds.max * 1.3).toFixed(2))
      }
      return
    }

    const zone = entry.zone || 'industrial'
    const timeKey = parameter === 'noise_night' ? 'night' : 'day'
    const limit = this.prescribedLimits?.noise?.[zone]?.[timeKey] ?? 75
    entry.values[timeKey] = Number((limit * 1.3).toFixed(2))
  }

  async writeSimulatedReading(location, spikeParameter = null) {
    const entry = this.currentValues.get(location.id)
    if (!entry) return null

    if (entry.type === 'air') {
      AIR_PARAMETER_KEYS.forEach((parameter) => {
        entry.values[parameter] = withRandomWalk(entry.values[parameter], buildAirBaseline(location)[parameter])
      })
      this.applySpike(entry, spikeParameter)

      const ambientAir = { ...entry.values }
      const aqiResult = calculateAQI(ambientAir)
      const payload = {
        roId: location.roId,
        roName: location.roName ?? null,
        industryId: null,
        industryName: location.name,
        locationId: location.id,
        locationName: location.name,
        monitoringType: 'namp',
        monitoredByName: 'Simulated IoT Sensor',
        dateOfMonitoring: new Date(),
        dateOfAnalysis: new Date(),
        stackEmissions: null,
        ambientAir,
        aqi: aqiResult?.aqi ?? null,
        aqiCategory: aqiResult?.category ?? null,
        isViolation: false,
        violatedParameters: [],
        isSimulated: true,
        submittedBy: 'sensor-simulation',
        createdAt: serverTimestamp(),
      }

      const readingRef = await addDoc(collection(db, COLLECTIONS.AIR_READINGS), payload)
      await orchestrateReadingSubmission({
        readingType: 'air',
        readingId: readingRef.id,
        reading: payload,
      })
      return readingRef.id
    }

    if (entry.type === 'water') {
      const baseline = buildWaterBaseline(location, entry.waterType)
      const parameterKeys = entry.waterType === 'waste' ? WASTE_WATER_KEYS : NATURAL_WATER_KEYS
      parameterKeys.forEach((parameter) => {
        entry.values[parameter] = withRandomWalk(entry.values[parameter], baseline[parameter])
      })
      this.applySpike(entry, spikeParameter)

      const summary = { ...entry.values }
      const sample = {
        sampleNo: 1,
        ...entry.values,
        flags: {},
      }

      const payload = {
        roId: location.roId,
        roName: location.roName ?? null,
        industryId: null,
        industryName: location.name,
        locationId: location.id,
        locationName: location.name,
        waterType: entry.waterType,
        sampleCollectedFrom: location.name,
        sampleDescription: `Simulated ${entry.waterType} water sensor reading`,
        dateOfCollection: new Date(),
        dateReceived: new Date(),
        dateOfAnalysis: new Date(),
        sampleCollectedBy: 'Simulated IoT Sensor',
        sampleAnalyzedBy: 'Simulated IoT Sensor',
        samples: [sample],
        sampleCount: 1,
        summary,
        pH: summary.pH ?? null,
        BOD: summary.BOD ?? null,
        COD: summary.COD ?? null,
        isViolation: false,
        violatedParameters: [],
        isSimulated: true,
        submittedBy: 'sensor-simulation',
        createdAt: serverTimestamp(),
      }

      const readingRef = await addDoc(collection(db, COLLECTIONS.WATER_READINGS), payload)
      await orchestrateReadingSubmission({
        readingType: 'water',
        readingId: readingRef.id,
        reading: payload,
      })
      return readingRef.id
    }

    entry.values.day = withRandomWalk(entry.values.day, buildNoiseBaseline(location).day)
    entry.values.night = withRandomWalk(entry.values.night, buildNoiseBaseline(location).night)
    this.applySpike(entry, spikeParameter)

    const monitoringTime = Math.random() > 0.5 ? 'Day' : 'Night'
    const timeKey = monitoringTime === 'Night' ? 'night' : 'day'
    const selectedLevel = entry.values[timeKey]

    const payload = {
      roId: location.roId,
      roName: location.roName ?? null,
      industryId: null,
      industryName: location.name,
      locationId: location.id,
      locationName: location.name,
      monitoringType: 'package',
      dateOfMonitoring: new Date(),
      dateOfAnalysis: new Date(),
      monitoredByName: 'Simulated IoT Sensor',
      readings: [{
        locationName: location.name,
        zone: entry.zone,
        monitoringTime,
        noiseLevel: selectedLevel,
        flag: 'OK',
      }],
      readingCount: 1,
      averageNoiseLevel: selectedLevel,
      noiseLevel: selectedLevel,
      peakNoiseLevel: selectedLevel,
      zone: entry.zone,
      monitoringTime,
      isViolation: false,
      violatedReadings: [],
      isSimulated: true,
      submittedBy: 'sensor-simulation',
      createdAt: serverTimestamp(),
    }

    const readingRef = await addDoc(collection(db, COLLECTIONS.NOISE_READINGS), payload)
    await orchestrateReadingSubmission({
      readingType: 'noise',
      readingId: readingRef.id,
      reading: payload,
    })
    return readingRef.id
  }
}

const sensorSimulationService = new SensorSimulationService()

export { DEMO_INTERVAL_MS, DEFAULT_INTERVAL_MS }
export default sensorSimulationService
