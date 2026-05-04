import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { getStreak, getActionHistory } from '../services/api'
import { useUser } from '../context/UserContext'
import { dailySafeAmount, daysUntilPayday, todayStatus, STATES } from '../utils/decisionHelpers'
import { statusTheme, ui } from '../utils/designSystem'

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

const PERIOD_DAYS = { Weekly: 7, Biweekly: 14, Monthly: 30, Irregular: null }

function computePersonality(history) {
  if (history.length < 3) return null
  const bad = history.filter(h => h.spent)
  const good = history.filter(h => !h.spent)
  if (bad.length === 0) {
    return `You've made ${good.length} smart call${good.length !== 1 ? 's' : ''} without overspending. Checking first is working.`
  }
  const dayCount = {}
  bad.forEach(h => { const d = new Date(h.createdAt).getDay(); dayCount[d] = (dayCount[d] || 0) + 1 })
  const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekendBad = bad.filter(h => { const d = new Date(h.createdAt).getDay(); return d === 0 || d === 6 }).length
  const weekendPct = Math.round((weekendBad / bad.length) * 100)
  const eveningBad = bad.filter(h => new Date(h.createdAt).getHours() >= 18).length
  const eveningPct = Math.round((eveningBad / bad.length) * 100)
  const worstDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]
  const ratio = Math.round((good.length / history.length) * 100)
  if (weekendPct >= 60) return `You're a weekend spender — ${weekendPct}% of your passes happen Fri–Sun. Tighten up those days.`
  if (eveningPct >= 60) return `Evenings are your weak spot — ${eveningPct}% of your passes happen after 6pm.`
  if (worstDay && parseInt(worstDay[1]) >= 2) return `${fullDays[parseInt(worstDay[0])]}s are your hardest day — that's when most passes happen.`
  return `${ratio}% of your checks came back safe. You're mostly spending within your limits.`
}

function streakLabel(n) {
  if (n >= 10) return 'Checking first is becoming automatic.'
  if (n >= 5)  return 'You\'re building the habit of checking first.'
  if (n >= 2)  return 'Keep checking before you spend.'
  if (n === 1) return 'Day 1 — check before the next spend.'
  return 'Start a streak — check before your next spend.'
}

export default function Insights() {
  const navigate = useNavigate()
  const { user, refresh, syncError } = useUser()
  const [streak, setStreak]   = useState(0)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(!user)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!localStorage.getItem('ss_token')) { navigate('/login', { replace: true }); return }

    refresh()
      .then(u => {
        if (!u.onboardingCompleted) navigate('/onboarding', { replace: true })
      })
      .catch((err) => {
        if (!localStorage.getItem('ss_token')) { navigate('/login', { replace: true }); return }
        setError(err.message || 'Could not load your setup.')
      })
      .finally(() => setLoading(false))

    getStreak()
      .then(s => setStreak(s.currentStreak ?? 0))
      .catch(() => setStreak(user?.streak?.currentStreak ?? 0))

    getActionHistory(15)
      .then(setHistory)
      .catch(() => {})
  }, [navigate, refresh])

  if (loading) return <AppShell loading />
  if (!user) {
    return (
      <AppShell>
        <div className="mt-24 rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
          <h1 className="text-2xl font-black tracking-tight text-white/90">Let's set up your spending plan.</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-white/60">
            We could not load your setup yet. Sign in again or try once the connection is back.
          </p>
          {error && (
            <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200/80">
              {error}
            </p>
          )}
          <button type="button" onClick={() => navigate('/login', { replace: true })} className={`${ui.buttonPrimary} mt-5`}>
            Sign in
          </button>
        </div>
      </AppShell>
    )
  }

  const upcoming  = user.upcomingExpensesTotal ?? 0
  const status    = todayStatus(user.balance, user.nextPayday, upcoming)
  const theme     = statusTheme[status]
  const safeDay   = user.nextPayday ? dailySafeAmount(user.balance, user.nextPayday, upcoming) : 0
  const daysLeft  = user.nextPayday ? daysUntilPayday(user.nextPayday) : 0
  const message   = STATES[status]?.messages?.[0] ?? 'You have a clear answer.'

  // Pay period progress
  const periodTotal = PERIOD_DAYS[user.payFrequency] ?? daysLeft + 7
  const daysElapsed = Math.max(0, periodTotal - daysLeft)
  const periodPct   = Math.min(100, Math.round((daysElapsed / periodTotal) * 100))
  const budgetPct   = Math.min(100, Math.round((daysLeft / periodTotal) * 100))

  const thisWeekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const closeCalls  = history.filter(h => h.decision === 'WAIT' && new Date(h.createdAt) >= thisWeekStart).length
  const goodCalls   = history.filter(h => !h.spent).length
  const badCalls    = history.filter(h => h.spent).length
  const savedAmount = history.filter(h => !h.spent).reduce((sum, h) => sum + h.amount, 0)
  const personality = computePersonality(history)

  return (
    <AppShell tint={theme.tint}>
      <div className={ui.stack}>

        <header className="mb-2">
          <div className={ui.eyebrow}>Insights</div>
          <h1 className={`${ui.title} mt-3`}>Your spending checks.</h1>
          <p className={`${ui.subtitle} mt-3`}>Every time you checked before spending.</p>
        </header>

        {syncError && (
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.07] px-4 py-3 text-xs font-semibold leading-relaxed text-amber-100/80">
            {syncError}
          </div>
        )}

        {/* Status card */}
        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: theme.color, boxShadow: `0 0 10px rgba(${theme.rgb},0.34)` }}
            />
            <div className={ui.eyebrow}>Right now</div>
          </div>
          <div className={`mt-4 bg-gradient-to-br ${theme.gradient} bg-clip-text text-[48px] font-black leading-none tracking-tight text-transparent`}>
            {theme.word}
          </div>
          <div className={`mt-3 text-lg font-black tracking-tight ${theme.text}`}>{theme.label}</div>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-white/70">{message}</p>
        </section>

        {/* Key numbers */}
        <section className="grid grid-cols-3 gap-2">
          {[
            { label: user.activePot === 'cash' ? 'Cash' : 'Card', value: money(user.balance), color: 'rgba(255,255,255,0.88)' },
            { label: 'Safe / day', value: money(safeDay),      color: theme.color },
            { label: 'Days left',  value: `${daysLeft}d`,      color: 'rgba(255,255,255,0.88)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-4">
              <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">{label}</div>
              <div className="mt-2 text-[17px] font-black leading-none" style={{ color }}>{value}</div>
            </div>
          ))}
        </section>

        {/* Pay period progress */}
        {user.nextPayday && daysLeft > 0 && (
          <section className={`${ui.card} ${ui.cardPad}`}>
            <div className="flex items-center justify-between">
              <div className={ui.eyebrow}>Pay cycle</div>
              <div className="text-[11px] font-semibold text-white/40">
                {user.payFrequency ?? 'Monthly'}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs font-semibold text-white/50">
              <span>{daysElapsed}d done</span>
              <span>{daysLeft}d left</span>
            </div>

            {/* Timeline bar */}
            <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{
                  width: `${periodPct}%`,
                  background: `linear-gradient(to right, ${theme.color}99, ${theme.color})`,
                }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs font-medium text-white/45">
                {periodPct}% through the period
              </p>
              <p className="text-xs font-semibold" style={{ color: theme.color }}>
                {budgetPct}% budget left
              </p>
            </div>
          </section>
        )}

        {/* Streak */}
        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={ui.eyebrow}>Streak</div>
              <div className="mt-3 flex items-baseline gap-1.5">
                {streak > 0 && <span className="text-lg leading-none select-none">🔥</span>}
                <span className="text-[34px] font-black leading-none tracking-tight text-white/90">
                  {streak}
                </span>
                <span className="text-sm font-semibold text-white/40">
                  {streak === 1 ? 'day' : 'days'}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-white/55">
                {streakLabel(streak)}
              </p>
            </div>

            {streak >= 5 && (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] text-2xl"
              >
                {streak >= 10 ? '🏆' : '⭐'}
              </div>
            )}
          </div>

          {streak > 0 && (
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-700"
                style={{ width: `${Math.min(100, (streak / 10) * 100)}%` }}
              />
            </div>
          )}
        </section>

        {/* Your pattern — personality + close calls */}
        {personality && (
          <section className={`${ui.card} ${ui.cardPad}`}>
            <div className={ui.eyebrow}>Your pattern</div>
            <p className="mt-3 text-[15px] font-semibold leading-relaxed text-white/80">{personality}</p>
            {closeCalls > 0 && (
              <p className="mt-2 text-sm font-medium text-amber-300/70">
                {closeCalls} close call{closeCalls !== 1 ? 's' : ''} this week — you nearly went over.
              </p>
            )}
          </section>
        )}

        {/* This period — shareable survival card */}
        {history.length >= 3 && (
          <section className={`${ui.card} ${ui.cardPad}`}>
            <div className="flex items-center justify-between">
              <div className={ui.eyebrow}>This period</div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Screenshot to share</span>
            </div>
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent px-5 py-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.20em] text-white/30">Payday survival</p>
              <p className="mt-3 text-[22px] font-black leading-tight tracking-tight text-white">
                {daysElapsed}d down, {daysLeft}d to go
              </p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-300">{money(safeDay)}/day budget</p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Smart calls', value: goodCalls, color: '#34d399' },
                  { label: 'Passes', value: badCalls, color: '#f87171' },
                  { label: 'Kept', value: money(savedAmount), color: 'rgba(255,255,255,0.80)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/25">{label}</div>
                    <div className="mt-1 text-[18px] font-black leading-none" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-white/20">SmartSpend — check before you spend</p>
            </div>
          </section>
        )}

        {/* Spending history */}
        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className={ui.eyebrow}>Recent checks</div>
          {history.length === 0 ? (
            <p className="mt-4 text-sm font-medium text-white/40">
              Each time you check before spending, it shows up here.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {history.map(h => {
                const decColor = h.decision === 'YES'
                  ? '#34d399'
                  : h.decision === 'WAIT'
                    ? '#fbbf24'
                    : '#f87171'
                const date = new Date(h.createdAt)
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                return (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: decColor, boxShadow: `0 0 6px ${decColor}88` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-sm font-black ${h.spent ? 'text-rose-300' : 'text-emerald-300'}`}>
                          {h.spent ? '-' : ''}${h.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[11px] font-semibold text-white/35">
                          {h.spent ? 'spent' : 'skipped'}
                        </span>
                        {h.tag && (
                          <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-white/45">
                            {h.tag}
                          </span>
                        )}
                        {h.pot && (
                          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold capitalize text-white/35">
                            {h.pot}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-white/30">
                        {dateStr} · {timeStr}
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-black"
                      style={{ color: decColor, background: `${decColor}18` }}
                    >
                      {h.decision}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </AppShell>
  )
}
