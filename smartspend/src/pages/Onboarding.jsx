import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateProfile } from '../services/api'
import { useUser } from '../context/UserContext'
import DatePicker from '../components/DatePicker'
import { daysUntilPayday, computeDecision } from '../utils/decisionHelpers'
import { enablePush, isPushSupported, isIOS, isStandalone } from '../services/pushNotifications'

const FREQUENCIES = [
  { id: 'Weekly',    label: 'Weekly',    sub: 'Every week' },
  { id: 'Biweekly', label: 'Biweekly',  sub: 'Every two weeks' },
  { id: 'Monthly',  label: 'Monthly',   sub: 'Once a month' },
  { id: 'Irregular', label: 'Irregular', sub: 'No fixed schedule' },
]

export default function Onboarding() {
  const navigate  = useNavigate()
  const { setUser } = useUser()
  const [step, setStep]   = useState(1)
  const [demoAmount, setDemoAmount] = useState('')
  const [balance, setBalance] = useState('')
  const [payday,  setPayday]  = useState('')
  const [frequency, setFreq]  = useState('Monthly')
  const [loading, setLoading] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError,   setNotificationError]   = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [step])

  const minDate    = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  async function finish() {
    setLoading(true)
    setError('')
    try {
      const parsedBalance = parseFloat(balance)
      if (!Number.isFinite(parsedBalance) || parsedBalance < 0)
        throw new Error('Balance must be $0 or more.')
      if (!payday || daysUntilPayday(payday) <= 0)
        throw new Error('Choose a future payday.')

      const user = await updateProfile({
        balance: parsedBalance,
        nextPayday: new Date(`${payday}T12:00:00`).toISOString(),
        payFrequency: frequency,
        onboardingCompleted: true,
      })
      setUser(user)
      setStep(5)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function enableReminders() {
    setNotificationError('')
    if (!isPushSupported()) {
      if (isIOS() && !isStandalone()) {
        setNotificationError('On iPhone, add this app to your Home Screen first, then enable reminders.')
      } else {
        setNotificationError('Reminders are not available in this browser.')
      }
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

  const stepMeta = [
    { n: 1, label: 'How it works' },
    { n: 2, label: 'Balance' },
    { n: 3, label: 'Payday' },
    { n: 4, label: 'Pay cycle' },
    { n: 5, label: 'Reminders' },
  ]

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: '#0b0f1a' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-12 pb-10">

        {/* Progress */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold tracking-[0.22em] uppercase text-emerald-400">SmartSpend</span>
          <span className="text-xs font-semibold text-white/30">{step} of 5</span>
        </div>
        <div className="mb-10 flex gap-1.5">
          {stepMeta.map(({ n }) => (
            <div
              key={n}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{
                background: n < step
                  ? '#34d399'
                  : n === step
                    ? 'linear-gradient(to right, #34d399, #10b981)'
                    : 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>

        <div className="flex-1 flex flex-col">

          {/* Step 1 — How it works */}
          {step === 1 && (
            <div className="animate-fadeUp flex flex-1 flex-col">
              <div className="flex-1 flex flex-col justify-center">
                <h2 className="mb-3 text-[32px] font-black leading-tight tracking-tight text-white">
                  Check before<br />you spend.
                </h2>
                <p className="mb-8 text-[16px] font-medium leading-relaxed text-white/50">
                  Next time you're about to buy something — open SmartSpend first. Type the amount. Get YES or NO in 2 seconds.
                </p>

                <div className="flex flex-col gap-2 mb-8">
                  <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.5)' }} />
                    <span className="text-sm font-black text-white/85">Coffee run — $25</span>
                    <span className="ml-auto text-sm font-black text-emerald-400">YES</span>
                  </div>
                  <div className="flex items-center gap-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" style={{ boxShadow: '0 0 8px rgba(251,191,36,0.5)' }} />
                    <span className="text-sm font-black text-white/85">New shoes — $89</span>
                    <span className="ml-auto text-sm font-black text-amber-400">WAIT</span>
                  </div>
                  <div className="flex items-center gap-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-400" style={{ boxShadow: '0 0 8px rgba(248,113,113,0.5)' }} />
                    <span className="text-sm font-black text-white/85">Concert tickets — $180</span>
                    <span className="ml-auto text-sm font-black text-rose-400">NO</span>
                  </div>
                </div>

                <p className="text-[13px] font-semibold text-white/30">
                  Not after. Not in a monthly review. Before — at the moment it counts.
                </p>

                <div className="mt-6 border-t border-white/[0.07] pt-5">
                  <p className="mb-3 text-[13px] font-semibold text-white/40">Try it — type any amount:</p>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-white/30">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={demoAmount}
                      onChange={e => setDemoAmount(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] py-4 pl-10 pr-4 text-xl font-black text-white outline-none placeholder:text-white/20 focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/25 [color-scheme:dark]"
                    />
                  </div>
                  {(() => {
                    const n = parseFloat(demoAmount)
                    if (!n || n <= 0) return null
                    const fakePay = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
                    const { status } = computeDecision(500, fakePay, n, 0)
                    const cfg = {
                      safe:    { border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.07]', color: 'text-emerald-400', word: 'YES' },
                      careful: { border: 'border-amber-500/20',   bg: 'bg-amber-500/[0.07]',   color: 'text-amber-400',   word: 'WAIT' },
                      stop:    { border: 'border-rose-500/20',    bg: 'bg-rose-500/[0.07]',    color: 'text-rose-400',    word: 'NO' },
                    }[status]
                    return (
                      <div className={`mt-3 flex items-center justify-between rounded-2xl border px-4 py-3.5 ${cfg.border} ${cfg.bg}`}>
                        <span className="text-sm font-black text-white/75">${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                        <span className={`text-xl font-black ${cfg.color}`}>{cfg.word}</span>
                      </div>
                    )
                  })()}
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98]"
              >
                Set it up — takes 60 seconds
              </button>
            </div>
          )}

          {/* Step 2 — Balance */}
          {step === 2 && (
            <div className="animate-fadeUp flex flex-1 flex-col">
              <div className="flex-1">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                  Step 1 — Balance
                </p>
                <h2 className="mb-2 text-[28px] font-black leading-tight tracking-tight text-white">
                  How much do you<br />have right now?
                </h2>
                <p className="mb-10 text-[15px] font-medium text-white/45">
                  We use this to answer: can I afford this — before you buy.
                </p>
                <div className="relative">
                  <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-4xl font-light text-white/40">$</span>
                  <input
                    ref={inputRef}
                    type="number"
                    inputMode="decimal"
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    placeholder="500"
                    onKeyDown={e => e.key === 'Enter' && balance && setStep(3)}
                    className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] px-12 py-5 text-center text-5xl font-black text-white outline-none transition-all duration-200 placeholder:text-white/20 focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/25 [color-scheme:dark]"
                  />
                </div>
              </div>
              <button
                onClick={() => balance && setStep(3)}
                disabled={!balance}
                className="w-full rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-25 disabled:hover:scale-100"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 3 — Payday */}
          {step === 3 && (
            <div className="animate-fadeUp flex flex-1 flex-col">
              <div className="flex-1">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                  Step 2 — Payday
                </p>
                <h2 className="mb-2 text-[28px] font-black leading-tight tracking-tight text-white">
                  When does your<br />next pay land?
                </h2>
                <p className="mb-8 text-[15px] font-medium text-white/45">
                  Every answer is calibrated to this date.
                </p>
                <DatePicker value={payday} onChange={setPayday} minDate={minDateStr} />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => payday && setStep(4)}
                  disabled={!payday}
                  className="w-full rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-25 disabled:hover:scale-100"
                >
                  Continue
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="py-3 text-sm font-semibold text-white/35 transition-colors duration-200 hover:text-white/60 active:scale-[0.98]"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Frequency */}
          {step === 4 && (
            <div className="animate-fadeUp flex flex-1 flex-col">
              <div className="flex-1">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                  Step 3 — Pay cycle
                </p>
                <h2 className="mb-2 text-[28px] font-black leading-tight tracking-tight text-white">
                  How often do<br />you get paid?
                </h2>
                <p className="mb-8 text-[15px] font-medium text-white/45">
                  Shapes how tight each answer feels.
                </p>
                <div className="flex flex-col gap-2">
                  {FREQUENCIES.map(({ id, label, sub }) => (
                    <button
                      key={id}
                      onClick={() => setFreq(id)}
                      className={`flex items-center justify-between rounded-2xl px-5 py-4 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                        frequency === id
                          ? 'bg-emerald-500 shadow-[0_8px_24px_rgba(16,185,129,0.18)]'
                          : 'border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.07]'
                      }`}
                    >
                      <span className={`text-[15px] font-black ${frequency === id ? 'text-white' : 'text-white/75'}`}>
                        {label}
                      </span>
                      <span className={`text-xs font-semibold ${frequency === id ? 'text-white/70' : 'text-white/30'}`}>
                        {sub}
                      </span>
                    </button>
                  ))}
                </div>
                {error && (
                  <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm font-semibold text-rose-300">
                    {error}
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={finish}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading
                    ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    : "Let's go"}
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="py-3 text-sm font-semibold text-white/35 transition-colors duration-200 hover:text-white/60 active:scale-[0.98]"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 5 — Notifications */}
          {step === 5 && (
            <div className="animate-fadeUp flex flex-1 flex-col">
              <div className="flex-1">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
                  Almost done
                </p>
                <h2 className="mb-2 text-[28px] font-black leading-tight tracking-tight text-white">
                  Get a morning<br />check-in?
                </h2>
                <p className="mb-8 text-[15px] font-medium text-white/45">
                  Each morning we'll tell you what feels safe today.
                </p>

                {/* Preview card */}
                <div className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-5 py-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]" />
                    <div>
                      <p className="text-sm font-bold text-white/90">Daily reminder</p>
                      <p className="mt-0.5 text-xs font-medium text-white/50">
                        "You can spend $45 today" — 8:00 AM
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-3">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]" />
                    <div>
                      <p className="text-sm font-bold text-white/90">Evening nudge</p>
                      <p className="mt-0.5 text-xs font-medium text-white/50">
                        "About to spend tonight? Check first." — 7:00 PM
                      </p>
                    </div>
                  </div>
                </div>

                {notificationError && (
                  <div className="mt-4 animate-panelIn rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-sm font-semibold text-amber-100/80">
                    {notificationError}
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={enableReminders}
                  disabled={notificationLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {notificationLoading
                    ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    : 'Enable reminders'}
                </button>
                <button
                  onClick={() => navigate('/home', { replace: true })}
                  disabled={notificationLoading}
                  className="py-3 text-sm font-semibold text-white/35 transition-colors duration-200 hover:text-white/55 active:scale-[0.98] disabled:opacity-40"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
