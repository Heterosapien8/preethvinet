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

export function getAIAvailability() {
  return {
    online: Boolean(AI_CONFIG.apiKey),
    statusText: AI_CONFIG.apiKey ? 'Groq live' : 'PrithviAI is currently offline',
  }
}
