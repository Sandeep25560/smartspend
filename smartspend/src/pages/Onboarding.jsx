import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateProfile } from '../services/api'
import { useUser } from '../context/UserContext'
import DatePicker from '../components/DatePicker'
import { daysUntilPayday } from '../utils/decisionHelpers'
import { enablePush, isPushSupported } from '../services/pushNotifications'

const FREQUENCIES = ['Weekly', 'Biweekly', 'Monthly', 'Irregular']

export default function Onboarding() {
  const navigate = useNavigate()
  const { setUser } = useUser()
  const [step, setStep] = useState(1)
  const [balance, setBalance] = useState('')
  const [payday, setPayday] = useState('')
  const [frequency, setFreq] = useState('Monthly')
  const [loading, setLoading] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [step])

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  async function finish() {
    setLoading(true)
    setError('')
    try {
      const parsedBalance = parseFloat(balance)
      if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
        throw new Error('Balance must be $0 or more.')
      }

      if (!payday || daysUntilPayday(payday) <= 0) {
        throw new Error('Choose a future payday.')
      }

      const user = await updateProfile({
        balance: parsedBalance,
        nextPayday: new Date(`${payday}T12:00:00`).toISOString(),
        payFrequency: frequency,
        onboardingCompleted: true,
      })
      setUser(user)
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function enableReminders() {
    setNotificationError('')

    if (!isPushSupported()) {
      setNotificationError('Reminders are not available in this browser.')
      return
    }

    setNotificationLoading(true)
    try {
      await enablePush()
      navigate('/home', { replace: true })
    } catch (err) {
      const message = err.message === 'denied'
        ? 'Notifications are blocked. You can turn them on later in Settings.'
        : err.message === 'dismissed'
          ? 'No worries. You can turn this on later in Settings.'
          : err.message || 'Could not enable reminders.'
      setNotificationError(message)
    } finally {
      setNotificationLoading(false)
    }
  }

  function skipReminders() {
    navigate('/home', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex gap-2 mb-10">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-500 ${n <= step ? 'bg-emerald-500' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="flex-1 flex flex-col">
          {step === 1 && (
            <div className="animate-fadeUp flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4">Step 1 of 4</p>
                <h2 className="text-3xl font-black text-white mb-2 leading-tight">How much money<br />do you have right now?</h2>
                <p className="text-white/60 mb-10">The money you can use right now.</p>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-4xl font-light text-white/60 pointer-events-none">$</span>
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    placeholder="500"
                    onKeyDown={e => e.key === 'Enter' && balance && setStep(2)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-12 py-5 text-center text-5xl font-bold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40"
                  />
                </div>
              </div>
              <button onClick={() => balance && setStep(2)} disabled={!balance}
                className="w-full rounded-2xl bg-emerald-500 py-4 font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-30 disabled:hover:scale-100">
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fadeUp flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4">Step 2 of 4</p>
                <h2 className="text-3xl font-black text-white mb-2 leading-tight">When is your next<br />money coming in?</h2>
                <p className="text-white/60 mb-6">So your money lasts until then.</p>
                <DatePicker value={payday} onChange={setPayday} minDate={minDateStr} />
              </div>
              <div className="space-y-3">
                <button onClick={() => payday && setStep(3)} disabled={!payday}
                  className="w-full rounded-2xl bg-emerald-500 py-4 font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-30 disabled:hover:scale-100">
                  Continue
                </button>
                <button onClick={() => setStep(1)} className="w-full py-2 text-sm font-medium text-white/60 transition-all duration-200 hover:text-white/80 active:scale-[0.98]">Back</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fadeUp flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4">Step 3 of 4</p>
                <h2 className="text-3xl font-black text-white mb-2 leading-tight">How often do you<br />usually get paid?</h2>
                <p className="text-white/60 mb-10">So each answer feels right.</p>
                <div className="space-y-3">
                  {FREQUENCIES.map(f => (
                    <button
                      key={f}
                      onClick={() => setFreq(f)}
                      className={`w-full rounded-2xl px-5 py-4 text-left text-base font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        frequency === f
                          ? 'bg-emerald-500 text-white'
                          : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {error && <div className="mt-4 text-rose-300 text-sm font-medium">{error}</div>}
              </div>
              <div className="space-y-3 mt-6">
                <button onClick={finish} disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100">
                  {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Let's go"}
                </button>
                <button onClick={() => setStep(2)} className="w-full py-2 text-sm font-medium text-white/60 transition-all duration-200 hover:text-white/80 active:scale-[0.98]">Back</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fadeUp flex-1 flex flex-col">
              <div className="flex-1">
                <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4">Optional</p>
                <h2 className="text-3xl font-black text-white mb-2 leading-tight">Get a daily<br />check-in?</h2>
                <p className="text-white/60 mb-8">
                  Every morning, we'll tell you what feels safe today.
                </p>

                <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-5 shadow-[0_14px_44px_rgba(0,0,0,0.22)]">
                  <div className="flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.32)]" />
                    <div>
                      <p className="text-sm font-bold text-white/90">Daily reminders</p>
                      <p className="mt-1 text-xs font-medium text-white/60">8:00 AM morning check-in.</p>
                    </div>
                  </div>
                </div>

                {notificationError && (
                  <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-100/80">
                    {notificationError}
                  </div>
                )}
              </div>

              <div className="space-y-3 mt-6">
                <button
                  onClick={enableReminders}
                  disabled={notificationLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {notificationLoading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Enable reminders'}
                </button>
                <button
                  onClick={skipReminders}
                  disabled={notificationLoading}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-bold text-white/70 transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 hover:text-white/90 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                >
                  Not now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
