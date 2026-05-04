import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import MetricCard from '../components/MetricCard'
import { getStreak } from '../services/api'
import { useUser } from '../context/UserContext'
import { dailySafeAmount, daysUntilPayday, todayStatus, STATES } from '../utils/decisionHelpers'
import { statusTheme, ui } from '../utils/designSystem'

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export default function Insights() {
  const navigate = useNavigate()
  const { user, refresh, syncError } = useUser()
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(!user)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('ss_token')) { navigate('/login', { replace: true }); return }

    refresh()
      .then(u => {
        if (!u.onboardingCompleted) navigate('/onboarding', { replace: true })
      })
      .catch((err) => {
        if (!localStorage.getItem('ss_token')) {
          navigate('/login', { replace: true })
          return
        }

        setError(err.message || 'Could not load your setup.')
      })
      .finally(() => setLoading(false))

    getStreak()
      .then(s => setStreak(s.currentStreak ?? 0))
      .catch(() => setStreak(user?.streak?.currentStreak ?? 0))
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
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className={`${ui.buttonPrimary} mt-5`}
          >
            Sign in
          </button>
        </div>
      </AppShell>
    )
  }

  const status = todayStatus(user.balance, user.nextPayday)
  const theme = statusTheme[status]
  const safeDay = user.nextPayday ? dailySafeAmount(user.balance, user.nextPayday) : 0
  const daysLeft = user.nextPayday ? daysUntilPayday(user.nextPayday) : 0
  const message = STATES[status]?.messages?.[0] ?? 'You have a clear answer.'

  return (
    <AppShell tint={theme.tint}>
      <div className={ui.stack}>
        <header className="mb-2">
          <div className={ui.eyebrow}>Insights</div>
          <h1 className={`${ui.title} mt-3`}>Today, simplified.</h1>
          <p className={`${ui.subtitle} mt-3`}>
            Just enough to know what feels safe.
          </p>
        </header>

        {syncError && (
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.07] px-4 py-3 text-xs font-semibold leading-relaxed text-amber-100/80">
            {syncError}
          </div>
        )}

        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: theme.color,
                boxShadow: `0 0 10px rgba(${theme.rgb},0.34)`,
              }}
            />
            <div className={ui.eyebrow}>Right now</div>
          </div>

          <div
            className={`mt-4 bg-gradient-to-br ${theme.gradient} bg-clip-text text-[48px] font-black leading-none tracking-tight text-transparent`}
          >
            {theme.word}
          </div>
          <div className={`mt-3 text-lg font-black tracking-tight ${theme.text}`}>
            {theme.label}
          </div>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-white/70">
            {message}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <MetricCard
            label="Safe today"
            value={money(safeDay)}
            accent={statusTheme.safe.color}
          />
          <MetricCard
            label="Days to payday"
            value={daysLeft}
          />
        </section>

        <MetricCard
          label="You have"
          value={money(user.balance)}
        />

        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className="text-[34px] font-black leading-none tracking-tight text-white/90">
            {streak} day{streak === 1 ? '' : 's'}
          </div>
          <p className="mt-3 text-sm font-semibold leading-relaxed text-white/60">
            {streak > 0 ? 'Streak - staying on track.' : 'Start a streak with one clear call.'}
          </p>
        </section>
      </div>
    </AppShell>
  )
}
