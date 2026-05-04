import { getVapidPublicKey, subscribeToNotifications, unsubscribeFromNotifications } from './api'

export function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

export function currentPermission() {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export function isSubscribed() {
  return localStorage.getItem('ss_push_subscribed') === 'true'
}

export async function enablePush() {
  const reg = await Promise.race([
    navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Service worker timed out.')), 8000)),
  ])

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'denied' : 'dismissed')
  }

  const vapidKey = await getVapidPublicKey()
  if (!vapidKey) throw new Error('Could not load server push key.')

  const existing = await reg.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()

  let sub
  try {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToUint8(vapidKey),
    })
  } catch (e) {
    throw new Error('Push subscription failed: ' + (e.message ?? String(e)))
  }

  try {
    await subscribeToNotifications(sub)
  } catch (e) {
    throw new Error('Failed to save subscription: ' + (e.message ?? String(e)))
  }

  localStorage.setItem('ss_push_subscribed', 'true')
  return sub
}

export async function disablePush() {
  let endpoint = null

  if (isPushSupported()) {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve => setTimeout(() => resolve(null), 1500)),
    ]).catch(() => null)
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      endpoint = sub.endpoint
      await sub.unsubscribe()
    }
  }

  await unsubscribeFromNotifications(endpoint).catch(() => {})
  localStorage.removeItem('ss_push_subscribed')
}

function b64ToUint8(base64) {
  const pad  = '='.repeat((4 - base64.length % 4) % 4)
  const b64  = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw  = atob(b64)
  const out  = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
