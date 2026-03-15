import Groq from 'groq-sdk'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import { AI_CONFIG, COLLECTIONS, ROLES } from '../../config/constants'
import { extractTextFromPDF } from '../pdfExtractor'

const PRITHVIAI_SYSTEM_PROMPT = `You are PrithviAI, the compliance intelligence assistant for the Environment Department, Chhattisgarh Government. You help Regional Officers and Super Admins understand pollution data, compliance status, and inspection priorities.

Before answering, classify the user request into one of these intents: VIOLATION_QUERY, COMPLIANCE_STATUS, TREND_QUERY, REPORT_STATUS, GENERAL_HELP.
Always be concise, factual, and cite specific data from the context provided.
If the data does not contain the answer, say so clearly.
Do NOT make up values or invent readings.
Respond in 2-4 sentences unless a list is specifically needed.`

const CITIZEN_BOT_SYSTEM_PROMPT = `You are a friendly public health assistant on the PrithviNet citizen portal for Chhattisgarh, India. You explain environmental data in simple, non-technical language to ordinary citizens.
Always be empathetic, reassuring where appropriate, and give practical health advice.
Never use technical jargon without explaining it.
Base your answers on the current readings shown in the portal context provided.
Keep answers to 2-4 sentences.
If asked about a specific reading, explain what it means for daily life, not just the number.`

const EXTRACTION_PROMPT_TEMPLATE = `You are a document data extraction assistant for the Chhattisgarh Environment Conservation Board (CECB) industry registration system.

Extract the following information from the provided document text and return ONLY a valid JSON object.
If a field cannot be found in the document, set its value to null.
Do not guess or invent values. Extract only what is explicitly stated.

Extract these fields:
{
  "industryName": string | null,
  "industryType": string | null,
  "constitution": string | null,
  "authorizedSignatory": string | null,
  "registeredAddress": string | null,
  "city": string | null,
  "district": string | null,
  "pinCode": string | null,
  "contactNumber": string | null,
  "email": string | null,
  "gstNumber": string | null,
  "cinNumber": string | null,
  "panNumber": string | null,
  "natureOfIndustry": string | null,
  "totalPlotArea": number | null,
  "waterConsumption": number | null,
  "numberOfStacks": number | null,
  "proposedCommencementDate": string | null
}

Return ONLY the JSON object. No explanation, no markdown, no preamble.

DOCUMENT TEXT:
`

const groqClient = AI_CONFIG.apiKey
  ? new Groq({
      apiKey: AI_CONFIG.apiKey,
      dangerouslyAllowBrowser: true,
    })
  : null

function mapDoc(docSnap) {
  return { id: docSnap.id, ...docSnap.data() }
}

function formatTimestamp(value) {
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  return value ?? null
}

function sanitizeViolations(items) {
  return items.map((item) => ({
    id: item.id,
    industryName: item.industryName ?? 'Unknown industry',
    cityName: item.cityName ?? item.roName ?? 'Unknown city',
    readingType: item.readingType ?? 'unknown',
    severity: item.severity ?? 'medium',
    status: item.status ?? 'open',
    detectedAt: formatTimestamp(item.detectedAt),
    violatedParameters: (item.violatedParameters ?? []).map((param) => ({
      parameter: param.parameter,
      measured: param.measured,
      limit: param.limit,
      unit: param.unit ?? '',
    })),
  }))
}

function sanitizeEscalations(items) {
  return items.map((item) => ({
    id: item.id,
    industryName: item.industryName ?? 'Unknown industry',
    roName: item.roName ?? 'Unknown region',
    status: item.status ?? 'PENDING',
    severity: item.severity ?? 'medium',
    inspectionDate: item.inspectionDate ?? null,
    updatedAt: formatTimestamp(item.updatedAt),
  }))
}

function sanitizeReadings(items) {
  return items.map((item) => ({
    id: item.id,
    industryName: item.industryName ?? 'Unknown source',
    locationId: item.locationId ?? null,
    roName: item.roName ?? null,
    createdAt: formatTimestamp(item.createdAt),
    aqi: item.aqi ?? null,
    ambientAir: {
      SO2: item.ambientAir?.SO2 ?? null,
      PM10: item.ambientAir?.PM10 ?? null,
      PM2_5: item.ambientAir?.PM2_5 ?? null,
      NO2: item.ambientAir?.NO2 ?? null,
    },
  }))
}

function sanitizeForecasts(items) {
  return items
    .filter((item) => item.predictedViolation)
    .map((item) => ({
      id: item.id,
      locationId: item.locationId ?? null,
      parameter: item.parameter ?? null,
      predictedViolation: Boolean(item.predictedViolation),
      prescribedLimit: item.prescribedLimit ?? null,
      nextPeak: item.forecastValues?.[0]?.value ?? null,
    }))
}

function sanitizeSimulatedReadings(items, prescribedLimits = {}) {
  return items.flatMap((item) => {
    const timestamp = formatTimestamp(item.createdAt)

    if (item.readingType === 'air' || item.ambientAir) {
      return Object.entries(item.ambientAir ?? {})
        .filter(([, value]) => Number.isFinite(Number(value)))
        .map(([parameter, value]) => ({
          locationName: item.locationName ?? item.industryName ?? 'Unknown station',
          parameter,
          value: Number(value),
          prescribedLimit: prescribedLimits.air?.[parameter] ?? null,
          timestamp,
        }))
    }

    if (item.waterType) {
      const summary = item.summary ?? {}
      return Object.entries(summary)
        .filter(([, value]) => Number.isFinite(Number(value)))
        .map(([parameter, value]) => ({
          locationName: item.locationName ?? item.industryName ?? 'Unknown station',
          parameter,
          value: Number(value),
          prescribedLimit: prescribedLimits.water?.[item.waterType]?.[parameter]?.max ?? null,
          timestamp,
        }))
    }

    if (Number.isFinite(Number(item.noiseLevel))) {
      return [{
        locationName: item.locationName ?? item.industryName ?? 'Unknown station',
        parameter: 'noiseLevel',
        value: Number(item.noiseLevel),
        prescribedLimit: prescribedLimits.noise?.[item.zone || 'industrial']?.[(item.monitoringTime === 'Night') ? 'night' : 'day'] ?? null,
        timestamp,
      }]
    }

    return []
  }).slice(0, 10)
}

async function getLatestSimulatedReadings(isAdmin, roId) {
  const buildScopedQuery = (collectionName) => (
    isAdmin
      ? query(collection(db, collectionName), where('isSimulated', '==', true), orderBy('createdAt', 'desc'), limit(5))
      : query(collection(db, collectionName), where('isSimulated', '==', true), where('roId', '==', roId), orderBy('createdAt', 'desc'), limit(5))
  )

  const [airReadings, waterReadings, noiseReadings, limitsSnapshot] = await Promise.all([
    getQueryDocs(buildScopedQuery(COLLECTIONS.AIR_READINGS)),
    getQueryDocs(buildScopedQuery(COLLECTIONS.WATER_READINGS)),
    getQueryDocs(buildScopedQuery(COLLECTIONS.NOISE_READINGS)),
    getQueryDocs(query(collection(db, COLLECTIONS.PRESCRIBED_LIMITS), limit(25))),
  ])

  const prescribedLimits = {
    air: {},
    water: { natural: {}, waste: {} },
    noise: {
      silence: { day: 50, night: 40 },
      residential: { day: 55, night: 45 },
      commercial: { day: 65, night: 55 },
      industrial: { day: 75, night: 70 },
    },
  }

  limitsSnapshot.forEach((item) => {
    if (item.department === 'air' && typeof item.limitMax === 'number') {
      prescribedLimits.air[item.parameter] = item.limitMax
    }
    if (item.department === 'water') {
      const bucket = item.parameter === 'COD' ? 'waste' : 'natural'
      prescribedLimits.water[bucket][item.parameter] = {
        min: item.limitMin,
        max: item.limitMax,
      }
    }
    if (item.department === 'noise' && item.zoneBasedLimits) {
      prescribedLimits.noise = item.zoneBasedLimits
    }
  })

  return sanitizeSimulatedReadings([
    ...airReadings.map((item) => ({ ...item, readingType: 'air' })),
    ...waterReadings,
    ...noiseReadings,
  ].sort((left, right) => {
    const leftTs = new Date(formatTimestamp(left.createdAt) ?? 0).getTime()
    const rightTs = new Date(formatTimestamp(right.createdAt) ?? 0).getTime()
    return rightTs - leftTs
  }), prescribedLimits)
}

async function getQueryDocs(queryRef) {
  const snapshot = await getDocs(queryRef)
  return snapshot.docs.map(mapDoc)
}

async function getQueryDocsSafe(queryRef) {
  try {
    return await getQueryDocs(queryRef)
  } catch (error) {
    console.warn('AI context query skipped:', error)
    return []
  }
}

async function getOfficerContext({ role, roId, roName }) {
  const isAdmin = role === ROLES.SUPER_ADMIN

  const violationQuery = isAdmin
    ? query(collection(db, COLLECTIONS.VIOLATIONS), orderBy('detectedAt', 'desc'), limit(5))
    : query(collection(db, COLLECTIONS.VIOLATIONS), where('roId', '==', roId), orderBy('detectedAt', 'desc'), limit(5))

  const escalationQuery = isAdmin
    ? query(collection(db, COLLECTIONS.ESCALATIONS), where('status', '!=', 'RESOLVED'), orderBy('status'), limit(5))
    : query(collection(db, COLLECTIONS.ESCALATIONS), where('roId', '==', roId), where('status', '!=', 'RESOLVED'), orderBy('status'), limit(5))

  const readingQuery = isAdmin
    ? query(collection(db, COLLECTIONS.AIR_READINGS), orderBy('createdAt', 'desc'), limit(7))
    : query(collection(db, COLLECTIONS.AIR_READINGS), where('roId', '==', roId), orderBy('createdAt', 'desc'), limit(7))

  const industryQuery = isAdmin
    ? query(collection(db, COLLECTIONS.INDUSTRIES), limit(100))
    : query(collection(db, COLLECTIONS.INDUSTRIES), where('roId', '==', roId), limit(100))

  const forecastQuery = query(collection(db, COLLECTIONS.FORECASTS), limit(25))

  const [violations, escalations, airReadings, industries, forecasts] = await Promise.all([
    getQueryDocs(violationQuery),
    getQueryDocs(escalationQuery),
    getQueryDocs(readingQuery),
    getQueryDocs(industryQuery),
    getQueryDocs(forecastQuery),
  ])
  const latestSimulatedReadings = await getLatestSimulatedReadings(isAdmin, roId)

  const compliantIndustries = industries.filter((item) => item.complianceStatus === 'compliant').length
  const pendingReports = industries.filter((item) => item.complianceStatus === 'pending').length
  const complianceRate = industries.length ? Number((compliantIndustries / industries.length).toFixed(2)) : 0

  return {
    scope: isAdmin ? 'statewide' : (roName ?? roId ?? 'regional'),
    recentViolations: sanitizeViolations(violations),
    activeEscalations: {
      count: escalations.length,
      items: sanitizeEscalations(escalations),
    },
    latestAirReadings: sanitizeReadings(airReadings),
    latestSimulatedReadings,
    complianceRate,
    pendingReports,
    forecastAlerts: sanitizeForecasts(forecasts),
  }
}

async function getCitizenContext({ cityId, cityName }) {
  const summaryQuery = cityId
    ? query(collection(db, COLLECTIONS.PUBLIC_SUMMARY), where('cityId', '==', cityId), limit(1))
    : query(collection(db, COLLECTIONS.PUBLIC_SUMMARY), limit(1))

  const summaryDocs = await getQueryDocsSafe(summaryQuery)
  const summary = summaryDocs[0] ?? null

  return {
    cityId: cityId ?? summary?.cityId ?? null,
    cityName: cityName ?? summary?.cityName ?? 'Selected city',
    publicSummary: summary ? {
      cityName: summary.cityName ?? cityName ?? 'Selected city',
      aqi: summary.aqi ?? null,
      aqiCategory: summary.aqiCategory ?? null,
      waterQualityStatus: summary.waterQualityStatus ?? null,
      noiseLevelDayAvg: summary.noiseLevelDayAvg ?? null,
      activeViolations: summary.activeViolations ?? 0,
      updatedAt: formatTimestamp(summary.updatedAt),
    } : null,
    recentViolations: [],
  }
}

async function callGroq(systemPrompt, question, context) {
  try {
    if (!AI_CONFIG.apiKey) {
      return { text: null, error: 'PrithviAI is currently offline' }
    }

    const response = await fetch(AI_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        temperature: AI_CONFIG.temperature,
        max_tokens: AI_CONFIG.maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `CURRENT DATA CONTEXT:\n${JSON.stringify(context, null, 2)}\n\nUSER QUESTION: ${question}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Groq AI error:', response.status, errorBody)
      return { text: null, error: 'PrithviAI is currently offline' }
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content?.trim() ?? null
    return { text, error: text ? null : 'PrithviAI is currently offline' }
  } catch (error) {
    console.error('Groq AI error:', error)
    return { text: null, error: 'PrithviAI is currently offline' }
  }
}

export async function queryPrithviAI(question, scope) {
  const firestoreContext = await getOfficerContext(scope)
  const response = await callGroq(PRITHVIAI_SYSTEM_PROMPT, question, firestoreContext)
  return { ...response, context: firestoreContext }
}

export async function queryCitizenBot(question, scope) {
  const publicSummaryContext = await getCitizenContext(scope)
  const response = await callGroq(CITIZEN_BOT_SYSTEM_PROMPT, question, publicSummaryContext)
  return { ...response, context: publicSummaryContext }
}

export async function extractIndustryDataFromPDF(file) {
  try {
    if (!groqClient) {
      return {
        data: null,
        filledFields: [],
        error: 'PrithviAI is currently offline. Please fill the form manually.',
      }
    }

    const pdfText = await extractTextFromPDF(file)

    if (!pdfText || pdfText.length < 50) {
      return {
        data: null,
        filledFields: [],
        error: 'Could not extract text from this PDF. It may be a scanned document. Please fill the form manually.',
      }
    }

    const truncatedText = pdfText.slice(0, 6000)
    const response = await groqClient.chat.completions.create({
      model: AI_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT_TEMPLATE + truncatedText,
        },
      ],
      temperature: 0,
      max_tokens: 800,
    })

    const raw = response.choices[0]?.message?.content ?? ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    const filledFields = Object.keys(parsed).filter((key) => parsed[key] !== null && parsed[key] !== '')

    return {
      data: parsed,
      filledFields,
      error: null,
    }
  } catch (error) {
    console.error('PDF extraction error:', error)
    return {
      data: null,
      filledFields: [],
      error: 'AI extraction failed. Please fill the form manually.',
    }
  }
}

export function getAIAvailability() {
  return {
    online: Boolean(AI_CONFIG.apiKey),
    statusText: AI_CONFIG.apiKey ? 'Groq live' : 'PrithviAI is currently offline',
  }
}
