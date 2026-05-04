const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5062/api').replace(/\/$/, '')

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

// Attempt to silently refresh the access token using the stored refresh token.
// Returns true on success (new token saved), false on failure.
async function tryRefresh() {
  const refreshToken = localStorage.getItem('ss_refresh_token')
  if (!refreshToken) return false

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) return false

    const data = await res.json()
    localStorage.setItem('ss_token', data.token)
    localStorage.setItem('ss_refresh_token', data.refreshToken)
    if (data.user) localStorage.setItem('ss_user', JSON.stringify(data.user))
    return true
  } catch {
    return false
  }
}

async function request(url, options, fallback, _retry = false) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)

    // On 401, try to refresh once then retry the original request
    if (res.status === 401 && !_retry) {
      const refreshed = await tryRefresh()
      if (refreshed) {
        const retryOptions = {
          ...options,
          headers: { ...options?.headers, ...authHeaders() },
        }
        return request(url, retryOptions, fallback, true)
      }
      // Refresh failed — clear everything and let the 401 propagate
      logout()
    }

    return await handle(res, fallback)
  } catch (error) {
    clearTimeout(timer)
    if (error instanceof ApiError) throw error
    if (error.name === 'AbortError') {
      throw new ApiError(
        'The server is taking too long to respond. It may be starting up — please try again in a moment.',
        0
      )
    }
    throw new ApiError('Could not connect. Check your connection and try again.', 0)
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signup(email, password) {
  const data = await request(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, 'Could not create your account. Try again.')

  localStorage.setItem('ss_token', data.token)
  if (data.refreshToken) localStorage.setItem('ss_refresh_token', data.refreshToken)
  if (data.user) localStorage.setItem('ss_user', JSON.stringify(data.user))
  return data
}

export async function login(email, password) {
  const data = await request(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, 'Could not sign in. Check your details.')

  localStorage.setItem('ss_token', data.token)
  if (data.refreshToken) localStorage.setItem('ss_refresh_token', data.refreshToken)
  if (data.user) localStorage.setItem('ss_user', JSON.stringify(data.user))
  return data
}

export function logout() {
  const refreshToken = localStorage.getItem('ss_refresh_token')
  // Fire-and-forget server-side revocation
  if (refreshToken) {
    fetch(`${BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
  }
  localStorage.removeItem('ss_token')
  localStorage.removeItem('ss_refresh_token')
  localStorage.removeItem('ss_user')
  localStorage.removeItem('ss_push_subscribed')
}

export async function forgotPassword(email) {
  return request(`${BASE}/auth/forgot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }, 'Could not send reset email. Try again.')
}

export async function resetPassword(token, password) {
  return request(`${BASE}/auth/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  }, 'Could not reset password. The link may have expired.')
}

export async function deleteAccount() {
  return request(`${BASE}/auth/account`, {
    method: 'DELETE',
    headers: authHeaders(),
  }, 'Could not delete account. Try again.')
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile() {
  return request(`${BASE}/user/profile`, { headers: authHeaders() }, 'Could not load your setup.')
}

export async function updateProfile(data) {
  const result = await request(`${BASE}/user/profile`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  }, 'Could not save your setup. Please retry.')
  if (data.balance !== undefined || data.cardBalance !== undefined || data.cashBalance !== undefined) {
    localStorage.setItem('ss_balance_updated_at', String(Date.now()))
  }
  return result
}

export async function joinSharedPlan(code) {
  return request(`${BASE}/share/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ code }),
  }, 'Could not join that shared plan.')
}

// ── Decisions ─────────────────────────────────────────────────────────────────

export async function checkDecision(amount) {
  return request(`${BASE}/decision/check`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount }),
  }, 'Something went wrong. Try again.')
}

export async function recordAction(amount, spent, sendPush = false, requestId = null, tag = null, pot = null) {
  return request(`${BASE}/action`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount, spent, sendPush, requestId, tag, pot }),
  }, "Couldn't update. Please retry.")
}

export async function updateActionTag(id, tag) {
  return request(`${BASE}/action/${id}/tag`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ tag }),
  }, "Couldn't save tag.")
}

export async function getActionHistory(limit = 20) {
  return request(`${BASE}/action/history?limit=${limit}`, {
    headers: authHeaders(),
  }, 'Could not load history.')
}

export async function notifyDecision(amount) {
  return request(`${BASE}/notifications/decision`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount }),
  }, 'Could not send the reminder.')
}

export async function scheduleDecisionPrompt(amount, requestId, decision = null, delaySeconds = 14, pot = null) {
  return request(`${BASE}/notifications/decision-prompt`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount, requestId, decision, delaySeconds, pot }),
  }, 'Could not schedule the reminder.')
}

export async function cancelDecisionPrompt(requestId) {
  return request(`${BASE}/notifications/decision-prompt/cancel`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ requestId }),
  }, 'Could not cancel the reminder.')
}

// ── Recurring expenses ────────────────────────────────────────────────────────

export async function getExpenses() {
  return request(`${BASE}/expenses`, { headers: authHeaders() }, 'Could not load expenses.')
}

export async function addExpense(name, amount, dayOfMonth) {
  return request(`${BASE}/expenses`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, amount, dayOfMonth }),
  }, 'Could not save expense.')
}

export async function deleteExpense(id) {
  return request(`${BASE}/expenses/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }, 'Could not delete expense.')
}

export async function exportActionsCsv() {
  async function fetchCsv(retry = false) {
    const res = await fetch(`${BASE}/export/actions.csv`, {
      headers: authHeaders(),
    })

    if (res.status === 401 && !retry && await tryRefresh()) {
      return fetchCsv(true)
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new ApiError(data.error ?? friendlyError(res.status, 'Could not export your data.'), res.status)
    }

    return res.blob()
  }

  const blob = await fetchCsv()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `smartspend-actions-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ── Streak ────────────────────────────────────────────────────────────────────

export async function getStreak() {
  return request(`${BASE}/streak`, { headers: authHeaders() }, 'Could not load your streak.')
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getVapidPublicKey() {
  const data = await request(`${BASE}/notifications/vapid-key`, undefined, 'Could not load notification settings.')
  return data.publicKey
}

export async function subscribeToNotifications(sub) {
  const p256dh = sub.getKey('p256dh')
  const auth   = sub.getKey('auth')

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function bufToB64(buffer) {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str)
}
