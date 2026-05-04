import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import NotificationCard from '../components/NotificationCard'
import { logout, updateProfile } from '../services/api'
import { useUser } from '../context/UserContext'
import { ui } from '../utils/designSystem'
import { daysUntilPayday } from '../utils/decisionHelpers'

const FREQUENCIES = ['Weekly', 'Biweekly', 'Monthly', 'Irregular']

export default function Settings() {
  const navigate = useNavigate()
  const { user, setUser, refresh, syncError } = useUser()
  const [balance, setBalance] = useState(user?.balance?.toString() ?? '')
  const [payday, setPayday] = useState(user?.nextPayday ? user.nextPayday.split('T')[0] : '')
  const [frequency, setFreq] = useState(user?.payFrequency ?? 'Monthly')
  const [loading, setLoading] = useState(!user)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  useEffect(() => {
    if (!localStorage.getItem('ss_token')) { navigate('/login', { replace: true }); return }

    refresh()
      .then(u => {
        if (!u.onboardingCompleted) {
          navigate('/onboarding', { replace: true })
          return
        }

        setBalance(u.balance?.toString() ?? '')
        setPayday(u.nextPayday ? u.nextPayday.split('T')[0] : '')
        setFreq(u.payFrequency ?? 'Monthly')
      })
      .catch((error) => {
        if (!localStorage.getItem('ss_token')) {
          navigate('/login', { replace: true })
          return
        }

        setError(error.message || 'Could not load your setup.')
      })
      .finally(() => setLoading(false))
  }, [navigate, refresh])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const parsedBalance = parseFloat(balance)
      if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
        throw new Error('Balance must be $0 or more.')
      }

      if (!payday || daysUntilPayday(payday) <= 0) {
        throw new Error('Choose a future payday.')
      }

      const u = await updateProfile({
        balance: parsedBalance,
        nextPayday: payday ? new Date(`${payday}T12:00:00`).toISOString() : null,
        payFrequency: frequency,
        onboardingCompleted: true,
      })
      setUser(u)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

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

  return (
    <AppShell>
      <div className={ui.stack}>
        <header className="mb-2">
          <div className={ui.eyebrow}>Settings</div>
          <h1 className={`${ui.title} mt-3`}>Keep it true.</h1>
          <p className={`${ui.subtitle} mt-3`}>
            Update the few things that shape your answer.
          </p>
        </header>

        {syncError && (
          <div className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.07] px-4 py-3 text-xs font-semibold leading-relaxed text-amber-100/80">
            {syncError}
          </div>
        )}

        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className="truncate text-base font-bold text-white/90">
            {user?.email}
          </div>
          <div className="mt-1 text-xs font-medium text-white/60">
            Signed in here.
          </div>
        </section>

        <section className={`${ui.card} ${ui.cardPad}`}>
          <div className="text-sm font-bold text-white/70">Your setup</div>

          <form onSubmit={save} className="mt-5 flex flex-col gap-4">
            <label className="block">
              <span className="text-sm font-semibold text-white/70">Balance</span>
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-white/50">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  required
                  className={`${ui.input} pl-8`}
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-white/70">Payday</span>
              <input
                type="date"
                value={payday}
                min={minDateStr}
                onChange={e => setPayday(e.target.value)}
                required
                className={`${ui.input} mt-2`}
              />
            </label>

            <div>
              <div className="text-sm font-semibold text-white/70">Pay cycle</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {FREQUENCIES.map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFreq(f)}
                    className={`rounded-2xl px-3 py-3 text-sm font-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                      frequency === f
                        ? 'bg-emerald-500 text-white'
                        : 'border border-white/10 bg-white/[0.045] text-white/70 hover:bg-white/[0.07]'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200/80">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className={ui.buttonPrimary}
            >
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save setup'}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <div className={ui.eyebrow}>Notifications</div>
          <NotificationCard />
        </section>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3.5 text-sm font-bold text-red-400 transition-all duration-200 hover:scale-[1.02] hover:bg-red-500/20 hover:text-red-300 active:scale-[0.98]"
        >
          Sign out
        </button>
      </div>
    </AppShell>
  )
}
