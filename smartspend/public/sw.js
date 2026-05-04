const DEFAULT_ICON = '/icon-192.png'
const HOME_URL = '/home'
const DECISION_TAG = 'smartspend-decision'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {}
  const title = payload.title ?? 'SmartSpend'
  const options = {
    body: payload.body ?? 'Check your spending today.',
    icon: payload.icon ?? DEFAULT_ICON,
    badge: payload.badge ?? DEFAULT_ICON,
    vibrate: [100, 50, 100],
    tag: payload.tag ?? 'smartspend',
    actions: payload.actions ?? [],
    data: payload.data ?? {},
    requireInteraction: payload.requireInteraction ?? false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  const action = event.action
  const notification = event.notification
  const data = notification.data ?? {}

  notification.close()

  if (isDecisionNotification(action, notification, data)) {
    event.waitUntil(handleDecisionAction(action, data))
    return
  }

  event.waitUntil(focusOrOpen(data.url ?? HOME_URL))
})

function isDecisionNotification(action, notification, data) {
  return action === 'yes' || action === 'no' || data.type === 'decision' || notification.tag === DECISION_TAG
}

async function handleDecisionAction(action, data) {
  if (action !== 'yes' && action !== 'no') {
    await focusOrOpen(HOME_URL)
    return
  }

  const spent = action === 'yes'

  try {
    const result = await recordDecisionAction(data, spent)
    await showOutcomeNotification(spent, result)
    await notifyOpenClients({ type: 'smartspend:action-recorded', spent, result })
  } catch (error) {
    console.error('[SmartSpend SW] Could not record notification action.', error)
    await self.registration.showNotification('SmartSpend', {
      body: 'Could not update. Open SmartSpend to check.',
      icon: DEFAULT_ICON,
      badge: DEFAULT_ICON,
      tag: 'smartspend-action-error',
      data: { url: HOME_URL },
    })
  }
}

async function recordDecisionAction(data, spent) {
  const amount = Number(data.amount)

  if (data.apiBase && data.promptToken) {
    const response = await fetch(`${data.apiBase}/api/notifications/action-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: data.promptToken, spent }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(result.error ?? `Action failed (${response.status}).`)
    }

    return result
  }

  if (!data.apiBase || !data.token || !Number.isFinite(amount)) {
    throw new Error('Missing action data.')
  }

  const response = await fetch(`${data.apiBase}/api/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
    body: JSON.stringify({ amount, spent, sendPush: false }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error ?? `Action failed (${response.status}).`)
  }

  return result
}

async function showOutcomeNotification(spent, result) {
  const title = spent ? 'Updated' : 'Good call.'
  const body = spent ? recoveryBody(result) : appreciationBody(result)

  await self.registration.showNotification(title, {
    body,
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    tag: spent ? 'smartspend-recovery' : 'smartspend-appreciation',
    renotify: true,
    data: {
      type: spent ? 'recovery' : 'appreciation',
      url: HOME_URL,
    },
  })
}

function appreciationBody(result) {
  const parts = ['You stayed on track.']
  const streak = Number(result.currentStreak ?? 0)

  if (result.streakIncreased && streak > 0) {
    parts.push(`Streak: Day ${streak} - staying on track.`)
  }

  if (result.confidenceMessage) {
    parts.push(result.confidenceMessage)
  }

  return parts.join(' ')
}

function recoveryBody(result) {
  const safe = formatMoney(result.newSafePerDay)
  if (!safe) return 'This pushes you off track. Open SmartSpend to check.'
  return `This pushes you off track. New safe: ${safe}/day.`
}

function formatMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

async function notifyOpenClients(message) {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  windows.forEach((client) => client.postMessage(message))
}

async function focusOrOpen(path) {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((client) => client.url.startsWith(self.location.origin))

  if (existing) {
    return existing.focus()
  }

  return clients.openWindow(path)
}
