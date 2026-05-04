import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendTestNotification } from '../services/api'
import {
  currentPermission,
  disablePush,
  enablePush,
  isPushSupported,
  isSubscribed,
} from '../services/pushNotifications'
import { ui } from '../utils/designSystem'

function Toggle({ checked, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={checked}
      className={`relative h-7 w-12 rounded-full border transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-300/40 disabled:opacity-50 disabled:hover:scale-100 ${
        checked ? 'border-emerald-300/50 bg-emerald-400' : 'border-white/20 bg-white/20'
      }`}
    >
      <span
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.24)] transition-all duration-300"
        style={{ left: checked ? '22px' : '4px' }}
      />
    </button>
  )
}

export default function NotificationCard({ compact = false }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [testState, setTestState] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isPushSupported()) { setStatus('unsupported'); return }
    if (currentPermission() === 'denied') { setStatus('denied'); return }
    if (currentPermission() !== 'granted') { setStatus('idle'); return }

    // Permission is granted — verify against the real browser subscription.
    // localStorage gets cleared on logout but the PushManager subscription
    // survives, so this correctly restores the "on" state after login.
    let cancelled = false
    ;(async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        if (cancelled) return
        const reg = regs.find(r => r.active)
        const sub = reg ? await reg.pushManager.getSubscription() : null
        if (cancelled) return
        if (sub) {
          localStorage.setItem('ss_push_subscribed', 'true')
          setStatus('on')
        } else {
          localStorage.removeItem('ss_push_subscribed')
          setStatus('idle')
        }
      } catch {
        if (!cancelled) setStatus(isSubscribed() ? 'on' : 'idle')
      }
    })()

    return () => { cancelled = true }
  }, [])

  const isOn = status === 'on'
  const isBusy = status === 'requesting' || status === 'turningOff'
  const compactLabel = status === 'unsupported'
    ? 'Reminders unavailable'
    : isOn
      ? 'Daily reminders on'
      : 'Daily reminders off'
  const helperText = status === 'unsupported'
    ? 'This browser does not support reminders.'
    : isOn
      ? "We'll nudge you each morning."
      : "We'll ask when you turn this on."

  async function toggle() {
    setError('')
    setTestState('idle')

    if (isOn) {
      setStatus('turningOff')
      try {
        await disablePush()
        setStatus('idle')
      } catch (e) {
        setError(e.message || 'Could not turn reminders off.')
        setStatus('on')
      }
      return
    }

    setStatus('requesting')
    try {
      await enablePush()
      setStatus('on')
    } catch (e) {
      if (e.message === 'denied') {
        setError('Notifications are blocked in this browser.')
        setStatus('denied')
      } else if (e.message === 'dismissed') {
        setStatus('idle')
      } else {
        setError(e.message || 'Could not enable reminders.')
        setStatus('idle')
      }
    }
  }

  async function test() {
    setTestState('sending')
    setError('')
    try {
      const result = await sendTestNotification()
      if ((result.sent ?? 0) > 0) {
        setTestState('sent')
        setTimeout(() => setTestState('idle'), 2200)
      } else {
        localStorage.removeItem('ss_push_subscribed')
        setStatus('idle')
        setTestState('idle')
        setError('Reminder expired. Turn it on again.')
      }
    } catch (e) {
      setTestState('idle')
      setError(e.message || 'Could not send test.')
    }
  }

  if (compact) {
    return (
      <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-4 shadow-[0_14px_44px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
        <div className="flex items-center gap-3">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: isOn ? '#34d399' : 'rgba(255,255,255,0.70)',
              boxShadow: isOn ? '0 0 10px rgba(52,211,153,0.30)' : 'none',
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white/80">
              {compactLabel}
              {isOn && <span className="text-white/60"> &middot; 8:00 AM</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90 transition-all duration-200 hover:scale-[1.02] hover:bg-white/20 active:scale-[0.98]"
          >
            Manage
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${ui.card} ${ui.cardPad}`}>
      <div className="flex items-center gap-3">
        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: isOn ? '#34d399' : 'rgba(255,255,255,0.45)',
            boxShadow: isOn ? '0 0 10px rgba(52,211,153,0.28)' : 'none',
          }}
        />

        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white/90">
            {status === 'unsupported'
              ? 'Reminders unavailable'
              : isOn
                ? 'Daily reminders on'
                : 'Daily reminders off'}
          </div>
          <div className="mt-1 text-xs font-medium leading-relaxed text-white/60">
            {helperText}
          </div>
        </div>

        <Toggle
          checked={isOn}
          disabled={isBusy || status === 'unsupported' || status === 'denied'}
          onClick={toggle}
        />
      </div>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
        <div>
          <div className="text-xs font-bold text-white/75">When</div>
          <div className="mt-0.5 text-xs text-white/60">Morning check-in</div>
        </div>
        <div className="text-sm font-black text-white">8:00 AM</div>
      </div>

      {isOn && (
        <button
          type="button"
          onClick={test}
          disabled={testState === 'sending'}
          className={`${ui.buttonGhost} mt-4 w-full py-3`}
        >
          {testState === 'sending' ? 'Sending...' : testState === 'sent' ? 'Test sent' : 'Test notification'}
        </button>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200/80">
          {error}
        </div>
      )}
    </div>
  )
}
