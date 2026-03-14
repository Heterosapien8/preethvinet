const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

// ---------------------------------------------------------------
// HACKATHON DEMO SEED SCRIPT
// This script seeds demo data for the PrithviNet hackathon demo.
//
// TO RUN:    node scripts/seedDemoData.js
// TO FORCE:  node scripts/seedDemoData.js --force  (overwrites existing)
//
// TO CLEAN UP AFTER THE HACKATHON:
// Option A - Delete via script:
//   node scripts/seedDemoData.js --clean
//   (implement --clean flag to delete all SEED_LOC001_SO2_* documents)
//
// Option B - Delete via Firebase Console:
//   Go to Firestore > airReadings > filter where readingId starts with
//   "SEED_LOC001_SO2_" and delete those 30 documents.
//
// The /forecasts/LOC001_SO2 document will be overwritten by the
// useForecastEngine hook on first page load, so no cleanup needed there.
// The /monitoringLocations/LOC001 document was merged (not replaced)
// so no cleanup needed there either.
// ---------------------------------------------------------------

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')

if (!fs.existsSync(serviceAccountPath)) {
  console.error('ERROR: scripts/serviceAccountKey.json not found.')
  console.error('Download it from Firebase Console > Project Settings > Service Accounts > Generate New Private Key')
  process.exit(1)
}

const serviceAccount = require(serviceAccountPath)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

function getDateString(offsetDays) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().split('T')[0]
}

function getTimestamp(offsetDays, hours, minutes) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  date.setHours(hours, minutes, 0, 0)
  return admin.firestore.Timestamp.fromDate(date)
}

const SO2_VALUES = [
  42.1, 39.4, 44.2, 41.8, 47.3, 45.1, 50.4, 48.2, 53.1, 51.4,
  55.2, 58.4, 54.8, 60.1, 57.3, 63.2, 61.0, 65.4, 63.1, 67.2,
  66.0, 68.4, 70.1, 71.3, 67.8, 73.2, 72.1, 75.4, 74.2, 78.1,
]

async function seed() {
  try {
    const shouldForce = process.argv.includes('--force')
    const shouldClean = process.argv.includes('--clean')

    console.log('PrithviNet Demo Seed Script')
    console.log('===========================')

    if (shouldClean) {
      console.log('Cleaning up seed data...')
      for (let index = 0; index < 30; index += 1) {
        const docId = `SEED_LOC001_SO2_${index}`
        await db.collection('airReadings').doc(docId).delete()
        console.log(`Deleted ${docId}`)
      }
      console.log('Cleanup complete.')
      return
    }

    console.log('Checking for existing seed data...')
    const existing = await db.collection('airReadings').doc('SEED_LOC001_SO2_0').get()

    if (existing.exists && !shouldForce) {
      console.log('Seed data already exists for LOC001 SO2.')
      console.log('Run with --force flag to overwrite: node scripts/seedDemoData.js --force')
      return
    }

    if (existing.exists && shouldForce) {
      console.log('Existing seed data found. Deleting old seed documents...')
      for (let index = 0; index < 30; index += 1) {
        await db.collection('airReadings').doc(`SEED_LOC001_SO2_${index}`).delete()
      }
      console.log('Old seed data deleted. Proceeding...')
    } else {
      console.log('No existing seed data found. Proceeding...')
    }

    console.log('')
    console.log('Seeding 30 air readings for LOC001 (Urla Industrial Area, Raipur)...')

    for (let index = 0; index < SO2_VALUES.length; index += 1) {
      const dayOffset = -(30 - index)
      const docId = `SEED_LOC001_SO2_${index}`
      const monitoringTimestamp = getTimestamp(dayOffset, 10, 0)
      const analysisTimestamp = getTimestamp(dayOffset, 14, 0)

      await db.collection('airReadings').doc(docId).set({
        readingId: docId,
        roId: 'RO-001',
        roName: 'Raipur Regional Office',
        industryId: 'IND-001',
        industryName: 'Jindal Power & Steel Ltd.',
        locationId: 'LOC001',
        monitoringType: 'namp',
        monitoredById: 'TEAM001',
        monitoredByName: 'Dr. Anil Sharma',
        dateOfMonitoring: monitoringTimestamp,
        dateOfAnalysis: analysisTimestamp,
        isSimulated: false,
        stackEmissions: null,
        ambientAir: {
          PM10: null,
          PM2_5: null,
          SO2: SO2_VALUES[index],
          NO2: null,
          O3: null,
          CO_8hr: null,
          MH3: null,
          Pb: null,
        },
        aqi: null,
        aqiCategory: null,
        isViolation: false,
        violatedParameters: [],
        createdAt: monitoringTimestamp,
        submittedBy: 'seed_script',
      })

      console.log(`[${index + 1}/30]  Day ${dayOffset}  SO2: ${SO2_VALUES[index]} ug/m3  ✓`)
    }

    console.log('')
    process.stdout.write('Upserting monitoring location LOC001...  ')
    await db.collection('monitoringLocations').doc('LOC001').set({
      locationId: 'LOC001',
      name: 'Urla Industrial Area',
      type: 'air',
      city: 'Raipur',
      roId: 'RO-001',
      roName: 'Raipur Regional Office',
      geoPoint: {
        lat: 21.2190,
        lng: 81.7010,
      },
      baselineValues: {
        PM10: 85.0,
        PM2_5: 45.0,
        SO2: 78.1,
        NO2: 52.0,
        noiseDay: 68.0,
        noiseNight: 58.0,
      },
      currentStatus: 'moderate',
      latestAQI: 142,
      latestAQICategory: 'Moderate',
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
    }, { merge: true })
    console.log('✓')

    console.log('')
    process.stdout.write('Writing pre-computed forecast document...  ')
    const forecastValues = [
      { date: getDateString(1), value: 79.8, isAboveLimit: false },
      { date: getDateString(2), value: 81.6, isAboveLimit: true },
      { date: getDateString(3), value: 83.4, isAboveLimit: true },
      { date: getDateString(4), value: 85.2, isAboveLimit: true },
      { date: getDateString(5), value: 87.0, isAboveLimit: true },
      { date: getDateString(6), value: 88.8, isAboveLimit: true },
      { date: getDateString(7), value: 90.6, isAboveLimit: true },
    ]

    await db.collection('forecasts').doc('LOC001_SO2').set({
      locationId: 'LOC001',
      parameter: 'SO2',
      department: 'air',
      historicalValues: [
        { date: getDateString(-14), value: 61.0 },
        { date: getDateString(-13), value: 65.4 },
        { date: getDateString(-12), value: 63.1 },
        { date: getDateString(-11), value: 67.2 },
        { date: getDateString(-10), value: 66.0 },
        { date: getDateString(-9), value: 68.4 },
        { date: getDateString(-8), value: 70.1 },
        { date: getDateString(-7), value: 71.3 },
        { date: getDateString(-6), value: 67.8 },
        { date: getDateString(-5), value: 73.2 },
        { date: getDateString(-4), value: 72.1 },
        { date: getDateString(-3), value: 75.4 },
        { date: getDateString(-2), value: 74.2 },
        { date: getDateString(-1), value: 78.1 },
      ],
      forecastValues,
      prescribedLimit: 80,
      predictedViolation: true,
      slope: 1.847,
      intercept: 38.2,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      _source: 'seed_script',
    })
    console.log('✓')

    const firstViolation = forecastValues.find((item) => item.isAboveLimit)

    console.log('')
    console.log('===========================')
    console.log('Seed complete. Summary:')
    console.log('  30 readings written to /airReadings/')
    console.log('  Document IDs: SEED_LOC001_SO2_0 → SEED_LOC001_SO2_29')
    console.log('  Location LOC001 upserted in /monitoringLocations/')
    console.log('  Forecast written to /forecasts/LOC001_SO2')
    console.log('  predictedViolation: true')
    if (firstViolation) {
      console.log(`  Forecast crosses 80 ug/m3 limit on: Day 2 (${firstViolation.date})`)
    }
    console.log('===========================')
    console.log('')
    console.log('=== Seed complete ===')
    console.log('30 air readings written to /airReadings/')
    console.log('LOC001 monitoring location upserted')
    console.log('Pre-computed forecast written to /forecasts/LOC001_SO2')
    console.log('Run the app and open the Forecast page to verify.')
  } finally {
    if (admin.apps.length > 0) {
      await admin.app().delete()
    }
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

// VERIFICATION:
// 1. Open Firebase Console > Firestore > airReadings
//    Filter: locationId == "LOC001"
//    You should see 30 documents with IDs SEED_LOC001_SO2_0 through
//    SEED_LOC001_SO2_29, each with ambientAir.SO2 populated.
//
// 2. Open Firebase Console > Firestore > forecasts
//    Open document LOC001_SO2
//    predictedViolation should be: true
//    forecastValues[1].isAboveLimit should be: true
//
// 3. Open Firebase Console > Firestore > monitoringLocations
//    Open document LOC001
//    baselineValues.SO2 should be: 78.1
//    currentStatus should be: "moderate"
//
// 4. Open the app, navigate to Forecast page
//    Select "Urla Industrial Area — Raipur" and "SO₂"
//    You should see the chart load with 14 historical points
//    and 7 forecast points, with the orange area crossing the
//    red 80 µg/m³ reference line at Day 2.
//    The orange violation alert banner should be visible.
