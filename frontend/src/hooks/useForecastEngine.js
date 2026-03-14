// ---------------------------------------------------------------
// TEMPORARY: Client-side forecast engine
// TODO: Remove this entire file once Firebase Cloud Functions
// are deployed. The Cloud Function at:
//   functions/src/scheduled/dailyForecast.js
// performs identical logic server-side on a daily schedule.
//
// TO MIGRATE (3 steps only):
//   1. In ForecastPage.jsx, replace useForecastEngine hook call
//      with a Firestore onSnapshot listener on:
//      doc(db, 'forecasts', `${locationId}_${parameter}`)
//   2. Delete this file (useForecastEngine.js)
//   3. Delete forecastMath.js
//   No other files need to change.
// ---------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { runForecastPipeline } from '../utils/forecastMath'

const PRESCRIBED_LIMITS = {
  SO2: 80,
  PM10: 100,
  PM2_5: 60,
  NO2: 80,
  pH: 8.5,
  BOD: 30,
}

function extractValue(readingData, parameter) {
  switch (parameter) {
    case 'SO2':
      return readingData.ambientAir?.SO2 ?? null
    case 'PM10':
      return readingData.ambientAir?.PM10 ?? null
    case 'PM2_5':
      return readingData.ambientAir?.PM2_5 ?? null
    case 'NO2':
      return readingData.ambientAir?.NO2 ?? null
    case 'pH':
      return readingData.samples?.[0]?.pH ?? null
    case 'BOD':
      return readingData.samples?.[0]?.BOD ?? null
    default:
      return null
  }
}

export function useForecastEngine(locationId, parameter, department = 'air') {
  const [forecastData, setForecastData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastComputed, setLastComputed] = useState(null)

  const computeAndStoreForecast = useCallback(async () => {
    if (!locationId || !parameter) return

    setLoading(true)
    setError(null)

    try {
      const collectionName = department === 'water' ? 'waterReadings' : 'airReadings'
      const thirtyDaysAgo = Timestamp.fromDate(
        new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))
      )

      const readingsQuery = query(
        collection(db, collectionName),
        where('locationId', '==', locationId),
        where('createdAt', '>=', thirtyDaysAgo),
        orderBy('createdAt', 'asc')
      )

      const snapshot = await getDocs(readingsQuery)

      if (snapshot.empty) {
        setForecastData(null)
        setError('No readings found for this location in the last 30 days. Submit some monitoring reports first.')
        return
      }

      const rawReadings = snapshot.docs
        .map((readingDoc) => {
          const data = readingDoc.data()
          return {
            createdAt: data.createdAt,
            value: extractValue(data, parameter),
          }
        })
        .filter((reading) => reading.value !== null && reading.value !== undefined)

      if (rawReadings.length < 7) {
        setForecastData(null)
        setError(`Only ${rawReadings.length} readings found. Need at least 7 to generate a forecast. Submit more monitoring reports for this location.`)
        return
      }

      const limit = PRESCRIBED_LIMITS[parameter] ?? 100
      const result = runForecastPipeline(rawReadings, limit)

      if (!result) {
        setForecastData(null)
        setError('Could not compute forecast. The readings may all be on the same day. More historical data is needed.')
        return
      }

      const computedAt = new Date()
      const localResult = {
        ...result,
        prescribedLimit: limit,
        generatedAt: result.generatedAt,
      }

      try {
        await setDoc(
          doc(db, 'forecasts', `${locationId}_${parameter}`),
          {
            locationId,
            parameter,
            department,
            historicalValues: result.historicalValues,
            forecastValues: result.forecastValues,
            prescribedLimit: limit,
            predictedViolation: result.predictedViolation,
            slope: result.slope,
            intercept: result.intercept,
            generatedAt: serverTimestamp(),
            _source: 'client_temporary',
          },
          { merge: false }
        )
      } catch (writeError) {
        console.error(writeError)
        setForecastData(localResult)
        setLastComputed(computedAt)
        setError('Forecast computed but could not be saved. Check your Firestore security rules.')
        return
      }

      setForecastData(localResult)
      setLastComputed(computedAt)
    } catch (unexpectedError) {
      console.error(unexpectedError)
      setForecastData(null)
      setError('An unexpected error occurred while computing the forecast.')
    } finally {
      setLoading(false)
    }
  }, [department, locationId, parameter])

  useEffect(() => {
    computeAndStoreForecast()
  }, [computeAndStoreForecast])

  return {
    forecastData,
    loading,
    error,
    lastComputed,
    recompute: computeAndStoreForecast,
  }
}

export default useForecastEngine
