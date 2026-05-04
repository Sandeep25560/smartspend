const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5062/api').replace(/\/$/, '')

// How long to wait before giving up on a single attempt (covers Render cold starts)
const REQUEST_TIMEOUT_MS = 35_000

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function authHeaders() {
  const token = localStorage.getItem('ss_token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function friendlyError(status, fallback) {
  if (status === 400) return fallback
  if (status === 401 || status === 403) return 'Please sign in again.'
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.'
  if (status >= 500) return 'Something went wrong. Try again.'
  return fallback
}

export function isAuthError(error) {
  return error?.status === 401 || error?.status === 403
}

async function handle(res, fallback = 'Something went wrong. Try again.') {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error ?? friendlyError(res.status, fallback), res.status)
  }
  return data
}

async function request(url, options, fallback) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return await handle(res, fallback)
  } catch (error) {
    clearTimeout(timer)
    if (error instanceof ApiError) throw error
    // AbortError means the request timed out
    if (error.name === 'AbortError') {
      throw new ApiError(
        'The server is taking too long to respond. It may be starting up — please try again in a moment.',
        0
      )
    }
    throw new ApiError('Could not connect. Check your connection and try again.', 0)
  }
}

export async function signup(email, password) {
  return request(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, 'Could not create your account. Try again.')
}

export async function login(email, password) {
  return request(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, 'Could not sign in. Check your details.')
}

export function logout() {
  localStorage.removeItem('ss_token')
  localStorage.removeItem('ss_user')
  localStorage.removeItem('ss_push_subscribed')
}

export async function getProfile() {
  return request(`${BASE}/user/profile`, { headers: authHeaders() }, 'Could not load your setup.')
}

export async function updateProfile(data) {
  return request(`${BASE}/user/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  }, 'Could not save your setup. Please retry.')
}

export async function checkDecision(amount) {
  return request(`${BASE}/decision/check`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount }),
  }, 'Something went wrong. Try again.')
}

export async function getStreak() {
  return request(`${BASE}/streak`, { headers: authHeaders() }, 'Could not load your streak.')
}

export async function getVapidPublicKey() {
  const data = await request(`${BASE}/notifications/vapid-key`, undefined, 'Could not load notification settings.')
  return data.publicKey
}

export async function subscribeToNotifications(sub) {
  const p256dh = sub.getKey('p256dh')
  const auth = sub.getKey('auth')

  return request(`${BASE}/notifications/subscribe`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: p256dh ? bufToB64(p256dh) : '',
      auth: auth ? bufToB64(auth) : '',
    }),
  }, 'Could not save notification settings.')
}

export async function unsubscribeFromNotifications(endpoint) {
  return request(`${BASE}/notifications/subscribe`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ endpoint }),
  }, 'Could not update notification settings.')
}

export async function sendTestNotification() {
  return request(`${BASE}/notifications/test`, {
    method: 'POST',
    headers: authHeaders(),
  }, 'Could not send test notification.')
}

export async function recordAction(amount, spent, sendPush = false) {
  return request(`${BASE}/action`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount, spent, sendPush }),
  }, "Couldn't update. Please retry.")
}

export async function notifyDecision(amount) {
  return request(`${BASE}/notifications/decision`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount }),
  }, 'Could not send the reminder.')
}

function bufToB64(buffer) {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str)
}
