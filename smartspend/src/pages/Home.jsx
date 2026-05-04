import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { notifyDecision, recordAction } from '../services/api'
import { isSubscribed } from '../services/pushNotifications'
import { useUser } from '../context/UserContext'
import {
  computeDecision, todayStatus, randomMessage, dailySafeAmount, daysUntilPayday,
} from '../utils/decisionHelpers'
import BottomNav from '../components/BottomNav'
import NotificationCard from '../components/NotificationCard'
import ActionPrompt from '../components/ActionPrompt'
import { ui } from '../utils/designSystem'

const DEC = {
  safe: {
    word: 'YES',
    anim: 'animate-yesGlow',
    color: '#34d399',
    gradA: '#6ee7b7',
    gradB: '#22c55e',
    rgb: '52,211,153',
    bgTo: '#071f17',
  },
  careful: {
    word: 'WAIT',
    anim: 'animate-waitPulse',
    color: '#fbbf24',
    gradA: '#fcd34d',
    gradB: '#f97316',
    rgb: '251,191,36',
    bgTo: '#2a1a00',
  },
  stop: {
    word: 'NO',
    anim: 'animate-shake',
    color: '#f87171',
    gradA: '#f87171',
    gradB: '#dc2626',
    rgb: '248,113,113',
    bgTo: '#1a0b0b',
  },
}

const DOT_COLOR = { safe: '#34d399', careful: '#fbbf24', stop: '#f87171' }

const TODAY_LABEL = { safe: 'Good', careful: 'Careful', stop: 'At Risk' }

const ACTION_PROMPT_DELAY = 14000
const ACTION_FALLBACK_TIMEOUT = 8500

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function haptic(ms = 8) {
  if (navigator.vibrate) navigator.vibrate(ms)
}

const emptyDecisionState = {
  amount: '',
  status: null,
  responded: false,
  spent: null,
  timerStarted: false,
  promptMode: 'hidden',
  capturedSafePerDay: 0,
  capturedNewSafePerDay: 0,
  capturedBalance: 0,
  capturedDaysLeft: 0,
  capturedStreak: 0,
  confidenceMessage: '',
  streakIncreased: false,
}

function sanitizeAmount(value) {
  const clean = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
  const [whole, cents = ''] = clean.split('.')

  if (clean.includes('.')) return `${whole}.${cents.slice(0, 2)}`
  return whole
}

function amountParts(value) {
  if (!value) return { whole: '0', cents: '', hasCents: false }

  const [rawWhole = '', rawCents = ''] = value.split('.')
  const whole = rawWhole.replace(/^0+(?=\d)/, '') || '0'

  return {
    whole,
    cents: rawCents,
    hasCents: value.includes('.'),
  }
}

function currentStreak(user) {
  return user?.streak?.currentStreak ?? user?.streak?.CurrentStreak ?? 0
}

function withStreak(user, streak) {
  return {
    ...user,
    streak: {
      ...(user?.streak ?? {}),
      currentStreak: streak,
      lastUpdated: new Date().toISOString(),
    },
  }
}

function confidenceFor(streak) {
  if (streak >= 5) return 'This is becoming a habit.'
  if (streak >= 2) return "You're getting better at this."
  return ''
}

function personalizationFor(safePerDay) {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()
  const candidates = []

  if (hour >= 18 && hour <= 23) candidates.push('Evenings are where spending slips.')
  if (day === 0 || day === 6) candidates.push('Weekends get expensive.')
  if (safePerDay > 0 && safePerDay < 25) candidates.push('Today is tighter than usual.')

  if (candidates.length === 0) return ''
  return candidates[now.getMinutes() % candidates.length]
}

export default function Home() {
  const navigate = useNavigate()
  const { user, setUser, refresh, syncError } = useUser()
  const [loading, setLoading] = useState(!user)
  const [pageError, setPageError] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [actionError, setActionError] = useState('')
  const [amount, setAmount] = useState('')
  const [slider, setSlider] = useState(0)
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')
  const [amountBump, setAmountBump] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [decisionState, setDecisionState] = useState(emptyDecisionState)
  const [actionLoading, setActionLoading] = useState(false)
  const inputRef = useRef(null)
  const bumpTimer = useRef(null)
  const actionTimer = useRef(null)
  const actionHideTimer = useRef(null)
  const actionBusy = useRef(false)
  const userRef = useRef(user)
  const decisionStateRef = useRef(emptyDecisionState)

  useEffect(() => {
    if (!localStorage.getItem('ss_token')) { navigate('/login', { replace: true }); return }
    refresh()
      .then(u => {
        if (!u.onboardingCompleted) navigate('/onboarding', { replace: true })
      })
      .catch((error) => {
        if (!localStorage.getItem('ss_token')) {
          navigate('/login', { replace: true })
          return
        }

        setPageError(error.message || 'Could not load your setup.')
      })
      .finally(() => setLoading(false))
  }, [navigate, refresh])

  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { decisionStateRef.current = decisionState }, [decisionState])

  const clearActionTimers = useCallback(() => {
    clearTimeout(actionTimer.current)
    clearTimeout(actionHideTimer.current)
  }, [])

  useEffect(() => () => {
    clearTimeout(bumpTimer.current)
    clearActionTimers()
  }, [clearActionTimers])

  useEffect(() => {
    clearActionTimers()
    actionBusy.current = false
    setActionLoading(false)

    if (!status || !parseFloat(amount)) {
      setDecisionState(emptyDecisionState)
      return undefined
    }

    setDecisionState({
      amount,
      status,
      responded: false,
      spent: null,
      timerStarted: true,
      promptMode: 'immediate',
      capturedSafePerDay: 0,
      capturedNewSafePerDay: 0,
      capturedBalance: 0,
      capturedDaysLeft: 0,
      capturedStreak: currentStreak(userRef.current),
      confidenceMessage: '',
      streakIncreased: false,
    })

    actionTimer.current = setTimeout(() => {
      // Send "Did you spend $X?" notification if subscribed and user hasn't responded in-app
      const snap = decisionStateRef.current
      if (
        snap.amount === amount &&
        snap.status === status &&
        !snap.responded &&
        snap.promptMode !== 'hidden' &&
        isSubscribed()
      ) {
        notifyDecision(parseFloat(amount)).catch(() => {})
      }

      setDecisionState(current => {
        if (
          current.amount !== amount ||
          current.status !== status ||
          current.responded ||
          current.promptMode === 'hidden'
        ) {
          return current
        }

        return { ...current, promptMode: 'fallback' }
      })

      actionHideTimer.current = setTimeout(() => {
        setDecisionState(current => {
          if (
            current.amount !== amount ||
            current.status !== status ||
            current.responded ||
            current.promptMode !== 'fallback'
          ) {
            return current
          }

          return { ...current, promptMode: 'hidden', timerStarted: false }
        })
      }, ACTION_FALLBACK_TIMEOUT)
    }, ACTION_PROMPT_DELAY)

    return clearActionTimers
  }, [amount, status, clearActionTimers])

  const triggerAmountBump = useCallback(() => {
    clearTimeout(bumpTimer.current)
    setAmountBump(true)
    bumpTimer.current = setTimeout(() => setAmountBump(false), 190)
  }, [])

  const respondToActionPrompt = useCallback((spent) => {
    if (actionBusy.current) return
    const currentDecision = decisionStateRef.current
    if (!currentDecision.status || currentDecision.responded) return

    haptic(spent ? 14 : 8)
    actionBusy.current = true
    clearActionTimers()
    setActionError('')

    const snap = userRef.current
    const currentAmount = currentDecision.amount
    const numAmount = parseFloat(currentAmount)

    const dL = snap?.nextPayday ? Math.max(1, daysUntilPayday(snap.nextPayday)) : 1
    const currentBalance = snap?.balance ?? 0
    const spd = snap ? currentBalance / dL : 0
    const optimisticBalance = spent ? Math.max(0, currentBalance - (numAmount || 0)) : currentBalance
    const optimisticNewSafePerDay = dL > 0 ? optimisticBalance / dL : 0
    const previousStreak = currentStreak(snap)
    const goodRestraint = !spent && currentDecision.status !== 'safe'
    const optimisticStreak = spent ? 0 : goodRestraint ? previousStreak + 1 : previousStreak
    const optimisticConfidence = goodRestraint ? confidenceFor(optimisticStreak) : ''

    setActionLoading(true)
    if (snap) {
      setUser(withStreak({
        ...snap,
        balance: optimisticBalance,
      }, optimisticStreak))
    }

    setDecisionState(current => {
      if (!current.status || current.responded) return current
      return {
        ...current,
        responded: true,
        spent,
        timerStarted: false,
        promptMode: 'answered',
        capturedSafePerDay: spd,
        capturedNewSafePerDay: optimisticNewSafePerDay,
        capturedBalance: currentBalance,
        capturedDaysLeft: dL,
        capturedStreak: optimisticStreak,
        confidenceMessage: optimisticConfidence,
        streakIncreased: goodRestraint,
      }
    })

    if (numAmount > 0 && snap) {
      recordAction(numAmount, spent, isSubscribed())
        .then(result => {
          if (!result) return
          const resolvedStreak = result.currentStreak ?? optimisticStreak
          setUser(withStreak({
            ...snap,
            balance: result.newBalance,
          }, resolvedStreak))
          setDecisionState(current => {
            if (
              current.amount !== currentAmount ||
              !current.responded ||
              current.status !== currentDecision.status
            ) {
              return current
            }

            return {
              ...current,
              capturedNewSafePerDay: result.newSafePerDay ?? current.capturedNewSafePerDay,
              capturedDaysLeft: result.daysLeft ?? current.capturedDaysLeft,
              capturedStreak: resolvedStreak,
              confidenceMessage: result.confidenceMessage ?? current.confidenceMessage,
              streakIncreased: result.streakIncreased ?? current.streakIncreased,
            }
          })
        })
        .catch((error) => {
          setActionError(error.message || "Couldn't update. Please retry.")
          setUser(snap)
          setDecisionState(current => {
            if (current.amount !== currentAmount || current.status !== currentDecision.status) {
              return current
            }

            return {
              ...current,
              responded: false,
              spent: null,
              promptMode: 'immediate',
              capturedSafePerDay: 0,
              capturedNewSafePerDay: 0,
              capturedBalance: 0,
              capturedDaysLeft: 0,
              capturedStreak: previousStreak,
              confidenceMessage: '',
              streakIncreased: false,
            }
          })
        })
        .finally(() => {
          actionBusy.current = false
          setActionLoading(false)
        })
    } else {
      actionBusy.current = false
      setActionLoading(false)
    }
  }, [clearActionTimers, setUser])

  const evaluate = useCallback((val) => {
    const n = parseFloat(val)
    setDecisionError('')

    if (!n || n <= 0) {
      setStatus(null)
      return
    }

    if (!user?.nextPayday) {
      setStatus(null)
      setDecisionError("Let's set up your spending plan.")
      return
    }

    if (daysUntilPayday(user.nextPayday) <= 0) {
      setStatus(null)
      setDecisionError('Your payday has passed. Update it.')
      return
    }

    if ((user.balance ?? 0) <= 0) {
      setStatus('stop')
      setMessage('Only essentials for now.')
      return
    }

    if (n > user.balance) {
      setStatus('stop')
      setMessage('This is more than what you have.')
      return
    }

    const { status: s } = computeDecision(user.balance, user.nextPayday, n)

    if (s !== status) {
      setMessage(randomMessage(s))
    }

    setStatus(s)
  }, [user, status])

  function onInput(e) {
    const v = sanitizeAmount(e.target.value)
    setAmount(v)
    setSlider(Math.min(parseFloat(v) || 0, sliderMax))
    evaluate(v)
    triggerAmountBump()
  }

  function onSlide(e) {
    const v = e.target.value
    setSlider(Number(v))
    setAmount(v)
    evaluate(v)
    triggerAmountBump()
  }

  function reset() {
    setAmount('')
    setSlider(0)
    setStatus(null)
    setDecisionError('')
    setActionError('')
    setTimeout(() => inputRef.current?.focus(), 40)
  }

  if (loading) return (
    <div className="flex h-screen items-center justify-center overflow-y-auto overflow-x-hidden no-scrollbar bg-[#0b0f1a]">
      <span className="w-6 h-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  )
  if (!user) return (
    <div className={ui.screen}>
      <div className={ui.container}>
        <div className="mt-24 rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
          <h1 className="text-2xl font-black tracking-tight text-white/90">Let's set up your spending plan.</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-white/60">
            We could not load your setup yet. Sign in again or try once the connection is back.
          </p>
          {pageError && (
            <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200/80">
              {pageError}
            </p>
          )}
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className={`${ui.buttonPrimary} mt-5`}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  )

  const todayS = todayStatus(user.balance, user.nextPayday)
  const safePerDay = user.nextPayday ? dailySafeAmount(user.balance, user.nextPayday) : 0
  const daysLeft = user.nextPayday ? daysUntilPayday(user.nextPayday) : 0
  const paydayPassed = !!user.nextPayday && daysLeft <= 0
  const hasNoBalance = (user.balance ?? 0) <= 0
  const sliderMax = Math.max(Math.ceil(user.balance ?? 100), 100)
  const dec = status ? DEC[status] : null
  const pct = (slider / sliderMax) * 100
  const fill = dec?.color ?? '#2a2a2d'
  const sliderGradient = dec
    ? `linear-gradient(to right, ${dec.gradA}, ${dec.gradB})`
    : 'linear-gradient(to right, #4ade80, #facc15)'
  const parts = amountParts(amount)
  const amountColor = dec ? dec.color : amount ? '#f4f4f5' : '#6b7280'
  const centsColor = dec ? `${dec.color}9e` : 'rgba(244,244,245,0.46)'
  const cursorColor = dec?.color ?? '#71717a'
  const personalizationMessage = status ? personalizationFor(safePerDay) : ''

  return (
    <div className={ui.screen}>

      {Object.entries(DEC).map(([s, d]) => (
        <div
          key={s}
          className="fixed inset-0 pointer-events-none"
          style={{
            opacity: status === s ? 1 : 0,
            transition: 'opacity 0.8s cubic-bezier(0.4,0,0.2,1)',
            background: `
              linear-gradient(180deg, rgba(11,15,26,0.90) 0%, rgba(11,15,26,0.84) 48%, ${d.bgTo}42 100%),
              radial-gradient(ellipse 70% 38% at 50% -4%, rgba(${d.rgb},0.11) 0%, transparent 68%),
              radial-gradient(ellipse 80% 50% at 50% 50%, rgba(${d.rgb},0.03) 0%, transparent 65%),
              radial-gradient(ellipse 50% 30% at 50% 108%, rgba(${d.rgb},0.05) 0%, transparent 72%)
            `,
          }}
        />
      ))}

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-12 pb-28">

        <div className="mb-8 animate-fadeIn">
          <p className="mb-1.5 text-[13px] font-semibold text-white/30">
            {greeting()}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: DOT_COLOR[todayS],
                boxShadow: `0 0 5px ${DOT_COLOR[todayS]}99`,
              }}
            />
            <p
              className="text-[11px] font-semibold tracking-[0.20em] uppercase"
              style={{ color: '#9ca3af' }}
            >
              Today — {TODAY_LABEL[todayS]}
            </p>
          </div>
        </div>

        {(syncError || pageError) && (
          <div className="animate-fadeIn mb-5 rounded-2xl border border-amber-400/15 bg-amber-500/[0.07] px-4 py-3 text-xs font-semibold leading-relaxed text-amber-100/80">
            {syncError || pageError}
          </div>
        )}

        {paydayPassed && (
          <div className="animate-fadeIn mb-5 flex items-start justify-between gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3.5">
            <div>
              <p className="text-sm font-bold text-amber-300">Your payday has passed.</p>
              <p className="mt-0.5 text-xs font-medium text-white/50">Update your settings so your answers stay accurate.</p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="shrink-0 rounded-xl bg-amber-400/20 px-3 py-1.5 text-xs font-bold text-amber-300 transition-all duration-200 hover:bg-amber-400/30 active:scale-[0.98]"
            >
              Update
            </button>
          </div>
        )}

        {hasNoBalance && !paydayPassed && (
          <div className="animate-fadeIn mb-5 rounded-2xl border border-red-400/20 bg-red-500/[0.07] px-4 py-3.5">
            <p className="text-sm font-bold text-red-300">Your balance is $0.</p>
            <p className="mt-0.5 text-xs font-medium text-white/50">Every spend puts you at risk right now.</p>
          </div>
        )}

        <div className="mb-8">
          <p
            className="text-[17px] font-medium mb-2.5 tracking-tight"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            Can I spend
          </p>

          <div
            style={{
              transform: amountBump ? 'scale(1.04)' : 'scale(1)',
              transformOrigin: 'left bottom',
              transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[44px] font-black leading-none select-none"
                style={{
                  color: dec ? dec.color : '#52525b',
                  transition: 'color 0.4s ease',
                }}
              >
                $
              </span>

              <div className="relative flex-1 min-w-0">
                <div
                  aria-hidden="true"
                  className="pointer-events-none flex items-baseline min-w-0 leading-none overflow-hidden"
                >
                  <span
                    className="font-black tracking-tight truncate"
                    style={{
                      fontSize: 'clamp(56px, 18vw, 80px)',
                      color: amountColor,
                      transition: 'color 0.4s ease',
                    }}
                  >
                    {parts.whole}
                  </span>

                  {parts.hasCents && (
                    <span
                      className="ml-0.5 font-bold tracking-tight"
                      style={{
                        fontSize: 'clamp(30px, 8vw, 42px)',
                        color: centsColor,
                        transition: 'color 0.4s ease',
                      }}
                    >
                      .{parts.cents}
                    </span>
                  )}

                  {inputFocused && (
                    <span
                      className="amount-caret"
                      style={{ color: cursorColor }}
                    />
                  )}
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={onInput}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="0"
                  autoFocus
                  aria-label="Amount"
                  className="absolute inset-0 z-10 h-full w-full bg-transparent border-none outline-none text-transparent placeholder:text-transparent caret-transparent"
                  style={{
                    fontSize: 'clamp(56px, 18vw, 80px)',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                height: '1px',
                marginTop: '6px',
                background: dec
                  ? `linear-gradient(to right, ${dec.color}55, ${dec.color}22, transparent)`
                  : 'linear-gradient(to right, rgba(255,255,255,0.07), transparent)',
                transform: `scaleX(${dec ? 1 : 0.2})`,
                transformOrigin: 'left',
                transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), background 0.4s ease',
              }}
            />
          </div>
        </div>

        <div className="mb-8">
          <div className="relative h-7">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#27272a]" />
            <div
              className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
              style={{
                width: `${pct}%`,
                background: dec ? sliderGradient : fill,
                boxShadow: dec ? `0 0 10px rgba(${dec.rgb},0.10)` : 'none',
                transition: 'width 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
              }}
            />
            <input
              type="range"
              min="0"
              max={sliderMax}
              step="1"
              value={slider}
              onChange={onSlide}
              aria-label="Adjust amount"
              className="relative z-10 transition-all duration-200 active:scale-110"
              style={{
                background: 'transparent',
                '--range-thumb-shadow': dec
                  ? '0 0 10px rgba(255,255,255,0.12), 0 8px 18px rgba(0,0,0,0.16)'
                  : '0 1px 4px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.10)',
              }}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-start">
          <div className="min-h-[340px] transition-all duration-200 ease-out">
            {dec ? (
              <div className="animate-panelIn">
              <p
                className={`${dec.anim} transform-gpu font-black tracking-tight bg-clip-text text-transparent`}
                style={{
                  fontSize: 'clamp(80px, 26vw, 108px)',
                  lineHeight: '1',
                  paddingBottom: '6px',
                  backgroundImage: `linear-gradient(160deg, ${dec.gradA} 0%, ${dec.gradB} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginBottom: '16px',
                  filter: status === 'safe'
                    ? 'drop-shadow(0 0 14px rgba(52,211,153,0.10))'
                    : 'none',
                }}
              >
                {dec.word}
              </p>

              <p
                className="animate-messageIn font-semibold leading-snug"
                style={{
                  fontSize: 'clamp(17px, 5vw, 21px)',
                  color: 'rgba(255,255,255,0.76)',
                  animationDelay: '50ms',
                }}
              >
                {message}
              </p>

              <ActionPrompt
                amount={decisionState.amount}
                mode={decisionState.promptMode}
                spent={decisionState.spent}
                onRespond={respondToActionPrompt}
                safePerDay={decisionState.capturedSafePerDay || safePerDay}
                newSafePerDay={decisionState.capturedNewSafePerDay || safePerDay}
                daysLeft={decisionState.capturedDaysLeft || daysLeft}
                balance={decisionState.capturedBalance || user.balance}
                streak={decisionState.capturedStreak}
                confidenceMessage={decisionState.confidenceMessage}
                streakIncreased={decisionState.streakIncreased}
                personalizationMessage={personalizationMessage}
                loading={actionLoading}
              />

              {actionError && (
                <div className="mt-4 animate-messageIn rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200/85">
                  {actionError}
                </div>
              )}
            </div>
            ) : (
            <div className="animate-fadeIn flex flex-col gap-5">

              {/* Key metrics — balance, safe/day, days until payday */}
              {!decisionError && user.nextPayday && !paydayPassed && !hasNoBalance && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Balance',
                      value: `$${(user.balance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                    },
                    {
                      label: 'Safe / day',
                      value: `$${safePerDay.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
                    },
                    {
                      label: 'Payday in',
                      value: `${daysLeft}d`,
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3.5"
                    >
                      <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                        {label}
                      </div>
                      <div className="mt-1.5 text-[15px] font-black text-white/80">{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Streak badge */}
              {!decisionError && currentStreak(user) > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] px-4 py-3">
                  <span className="text-base leading-none select-none">🔥</span>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-emerald-300">
                      Day {currentStreak(user)}
                    </span>
                    <span className="ml-1.5 text-xs font-medium text-white/45">
                      {currentStreak(user) >= 5
                        ? '— this is becoming a habit.'
                        : currentStreak(user) >= 2
                          ? "— you're getting better at this."
                          : '— keep it going.'}
                    </span>
                  </div>
                </div>
              )}

              {/* Prompt */}
              <p
                className="text-2xl font-medium leading-snug tracking-tight"
                style={{ color: 'rgba(255,255,255,0.60)' }}
              >
                {decisionError || 'What are you thinking of spending?'}
              </p>

              {decisionError === 'Your payday has passed. Update it.' && (
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className={`${ui.buttonGhost} px-4 py-3`}
                >
                  Update settings
                </button>
              )}

            </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <NotificationCard compact />
        </div>

        {amount && (
          <button
            onClick={reset}
            className="animate-riseIn mt-6 py-3 text-center text-sm font-medium opacity-50 transition-all duration-200 hover:scale-[1.02] hover:opacity-80 active:scale-[0.98]"
            style={{ color: '#a1a1aa' }}
          >
            Try a different amount
          </button>
        )}

      </div>

      <BottomNav />
    </div>
  )
}
