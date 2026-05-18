// OneSignal Server SDK — usado nas API routes (server-side)
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY!
const ONESIGNAL_BASE = 'https://onesignal.com/api/v1'

interface NotificationPayload {
  title: string
  message: string
  url?: string
  externalIds?: string[]  // user IDs
  data?: Record<string, any>
}

export async function sendPushNotification(payload: NotificationPayload) {
  const body: any = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: payload.title, pt: payload.title },
    contents: { en: payload.message, pt: payload.message },
    url: payload.url ?? 'https://medcontroll.vercel.app/dashboard',
    chrome_web_icon: 'https://medcontroll.vercel.app/icons/icon-192x192.png',
    firefox_icon: 'https://medcontroll.vercel.app/icons/icon-192x192.png',
    data: payload.data ?? {},
  }

  if (payload.externalIds && payload.externalIds.length > 0) {
    body.include_aliases = { external_id: payload.externalIds }
    body.target_channel = 'push'
  } else {
    body.included_segments = ['All']
  }

  const res = await fetch(`${ONESIGNAL_BASE}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) console.error('OneSignal error:', data)
  return data
}

export async function sendDoseReminder(params: {
  userId: string
  medicationName: string
  doseAmount: number
  doseUnit: string
  scheduledTime: string
  doseId: string
}) {
  return sendPushNotification({
    title: `💊 Hora do remédio!`,
    message: `${params.medicationName} — ${params.doseAmount} ${params.doseUnit} às ${params.scheduledTime}`,
    url: `https://medcontroll.vercel.app/dashboard`,
    externalIds: [params.userId],
    data: { doseId: params.doseId, type: 'dose_reminder' },
  })
}

export async function sendMissedDoseAlert(params: {
  caregiverId: string
  patientName: string
  medicationName: string
  scheduledTime: string
}) {
  return sendPushNotification({
    title: `⚠️ Dose não confirmada`,
    message: `${params.patientName} não confirmou ${params.medicationName} das ${params.scheduledTime}`,
    url: `https://medcontroll.vercel.app/dashboard/caregiver`,
    externalIds: [params.caregiverId],
    data: { type: 'caregiver_alert' },
  })
}

export async function sendStockAlert(params: {
  userId: string
  medicationName: string
  daysLeft: number
}) {
  return sendPushNotification({
    title: `📦 Estoque acabando`,
    message: `${params.medicationName} tem estoque para ~${params.daysLeft} dias. Compre mais!`,
    url: `https://medcontroll.vercel.app/dashboard/medications`,
    externalIds: [params.userId],
    data: { type: 'stock_alert' },
  })
}
