import emailjs from '@emailjs/browser'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../config/firebase'
import { COLLECTIONS } from '../../config/constants'

export const INDUSTRY_APPLICATION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
}

function mapSnapshot(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

function buildIndustryId(applicationId) {
  return `IND-${String(applicationId ?? '').slice(0, 6).toUpperCase()}`
}

function sanitizeNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getEmailConfig() {
  return {
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  }
}

async function sendDecisionEmail({ application, decision, notes }) {
  const config = getEmailConfig()
  const toEmail = application?.step1?.emailAddress

  if (!config.serviceId || !config.templateId || !config.publicKey || !toEmail) {
    return null
  }

  try {
    await emailjs.send(
      config.serviceId,
      config.templateId,
      {
        to_email: toEmail,
        industry_name: application?.step1?.industryName ?? 'Industry',
        application_id: application?.applicationId,
        decision,
        review_notes: notes ?? '',
        portal_link: `${window.location.origin}/register/status`,
        timestamp: new Date().toLocaleString('en-IN'),
      },
      config.publicKey
    )
    return true
  } catch (error) {
    console.warn('Decision email could not be sent:', error)
    return false
  }
}

export async function createIndustryApplication({
  step1,
  step2,
  step3,
  aiAssisted,
  aiExtractedFields,
}) {
  const docRef = await addDoc(collection(db, COLLECTIONS.INDUSTRY_APPLICATIONS), {
    status: INDUSTRY_APPLICATION_STATUS.SUBMITTED,
    submittedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: '',
    step1,
    step2,
    step3,
    aiAssisted: Boolean(aiAssisted),
    aiExtractedFields: aiExtractedFields ?? [],
    createdAt: serverTimestamp(),
  })

  await updateDoc(docRef, {
    applicationId: docRef.id,
  })

  const created = await getDoc(docRef)
  return { id: docRef.id, ...created.data() }
}

export async function getIndustryApplication(applicationId) {
  if (!applicationId) return null

  const snapshot = await getDoc(doc(db, COLLECTIONS.INDUSTRY_APPLICATIONS, applicationId))
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null
}

export function subscribeToIndustryApplications(statusFilter, callback) {
  const collectionRef = collection(db, COLLECTIONS.INDUSTRY_APPLICATIONS)
  const queryRef = statusFilter && statusFilter !== 'ALL'
    ? query(collectionRef, where('status', '==', statusFilter))
    : query(collectionRef, orderBy('createdAt', 'desc'))

  return onSnapshot(queryRef, (snapshot) => {
    const items = mapSnapshot(snapshot).sort((left, right) => {
      const leftTime = typeof left.createdAt?.toMillis === 'function' ? left.createdAt.toMillis() : 0
      const rightTime = typeof right.createdAt?.toMillis === 'function' ? right.createdAt.toMillis() : 0
      return rightTime - leftTime
    })
    callback(items)
  })
}

export async function getSubmittedApplicationsCount() {
  const snapshot = await getDocs(query(
    collection(db, COLLECTIONS.INDUSTRY_APPLICATIONS),
    where('status', '==', INDUSTRY_APPLICATION_STATUS.SUBMITTED),
    limit(100)
  ))
  return snapshot.size
}

export function subscribeToSubmittedApplicationsCount(callback) {
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.INDUSTRY_APPLICATIONS),
      where('status', '==', INDUSTRY_APPLICATION_STATUS.SUBMITTED)
    ),
    (snapshot) => callback(snapshot.size)
  )
}

export async function markApplicationUnderReview(applicationId, reviewerUid) {
  const appRef = doc(db, COLLECTIONS.INDUSTRY_APPLICATIONS, applicationId)
  await updateDoc(appRef, {
    status: INDUSTRY_APPLICATION_STATUS.UNDER_REVIEW,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewerUid ?? null,
    reviewNotes: '',
  })
}

export async function rejectIndustryApplication(applicationId, reviewerUid, reviewNotes) {
  const appRef = doc(db, COLLECTIONS.INDUSTRY_APPLICATIONS, applicationId)
  await updateDoc(appRef, {
    status: INDUSTRY_APPLICATION_STATUS.REJECTED,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewerUid ?? null,
    reviewNotes: reviewNotes?.trim() ?? '',
  })

  const application = await getIndustryApplication(applicationId)
  await sendDecisionEmail({
    application,
    decision: 'REJECTED',
    notes: reviewNotes,
  })
}

export async function approveIndustryApplication(applicationId, reviewer) {
  const appRef = doc(db, COLLECTIONS.INDUSTRY_APPLICATIONS, applicationId)
  const snapshot = await getDoc(appRef)

  if (!snapshot.exists()) {
    throw new Error('Application not found.')
  }

  const application = { id: snapshot.id, ...snapshot.data() }

  await updateDoc(appRef, {
    status: INDUSTRY_APPLICATION_STATUS.APPROVED,
    reviewedAt: serverTimestamp(),
    reviewedBy: reviewer?.uid ?? null,
    reviewNotes: '',
  })

  const existingIndustry = await getDocs(query(
    collection(db, COLLECTIONS.INDUSTRIES),
    where('sourceApplicationId', '==', application.applicationId),
    limit(1)
  ))

  if (existingIndustry.empty) {
    await addDoc(collection(db, COLLECTIONS.INDUSTRIES), {
      industryId: buildIndustryId(application.applicationId),
      name: application.step1?.industryName ?? '',
      type: application.step1?.industryType ?? '',
      industryType: String(application.step1?.industryType ?? 'other').toLowerCase(),
      monitoringType: 'all',
      address: application.step1?.registeredAddress ?? '',
      city: application.step1?.cityVillage ?? '',
      lat: sanitizeNumber(application.step1?.latitude),
      lng: sanitizeNumber(application.step1?.longitude),
      email: application.step1?.emailAddress ?? '',
      contactNo: application.step1?.contactNumber ?? '',
      status: 'Active',
      complianceStatus: 'pending',
      createdAt: serverTimestamp(),
      sourceApplicationId: application.applicationId,
      remark: `Approved registration application ${application.applicationId}`,
    })
  }

  const approvedApplication = await getIndustryApplication(applicationId)
  await sendDecisionEmail({
    application: approvedApplication,
    decision: 'APPROVED',
    notes: 'Your industry registration has been approved. Please use the status page for further updates.',
  })

  return approvedApplication
}
