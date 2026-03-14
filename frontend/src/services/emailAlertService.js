import emailjs from '@emailjs/browser'

function getEmailConfig() {
  return {
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
  }
}

function hasEmailConfig() {
  const config = getEmailConfig()
  return Boolean(config.serviceId && config.templateId && config.publicKey)
}

function uniqueRecipients(emails) {
  return [...new Set(emails.filter(Boolean))]
}

export async function sendViolationAlerts({
  industryName,
  parameter,
  value,
  limit,
  roEmail,
  superAdminEmail,
}) {
  if (!hasEmailConfig()) return []

  const config = getEmailConfig()
  const recipients = uniqueRecipients([roEmail, superAdminEmail])
  if (!recipients.length) return []

  return Promise.allSettled(
    recipients.map((email) => emailjs.send(
      config.serviceId,
      config.templateId,
      {
        to_email: email,
        industry_name: industryName,
        parameter,
        measured_value: value,
        prescribed_limit: limit,
        timestamp: new Date().toLocaleString('en-IN'),
        escalation_link: `${window.location.origin}/compliance/escalations`,
      },
      config.publicKey
    ))
  )
}
