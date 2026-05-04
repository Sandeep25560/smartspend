import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import NotificationCard from '../components/NotificationCard'
import { logout, updateProfile } from '../services/api'
import { useUser } from '../context/UserContext'
import { ui } from '../utils/designSystem'
import { daysUntilPayday } from '../utils/decisionHelpers'

const FREQUENCIES = [
  { id: 'Weekly',    label: 'Weekly',    sub: 'Every week' },
  { id: 'Biweekly', label: 'Biweekly',  sub: 'Every 2 weeks' },
  { id: 'Monthly',  label: 'Monthly',   sub: 'Once a month' },
  { id: 'Irregular', label: 'Irregular', sub: 'No fixed date' },
]

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
      .catch((err) => {
        if (!localStorage.getItem('ss_token')) { navigate('/login', { replace: true }); return }
        setError(err.message || 'Could not load your setup.')
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
      if (!Number.isFinite(parsedBalance) || parsedBalance < 0)
        throw new Error('Balance must be $0 or more.')
      if (!payday || daysUntilPayday(payday) <= 0)
        throw new Error('Choose a future payday.')

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

        {/* Account */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Account</div>
          <div className={`${ui.card} ${ui.cardPad}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/[0.12] text-sm font-black text-emerald-400">
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white/90">{user?.email}</div>
                <div className="mt-0.5 text-[11px] font-medium text-white/40">Active account</div>
              </div>
            </div>
          </div>
        </section>

        {/* Your setup */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Your setup</div>
          <div className={`${ui.card} ${ui.cardPad}`}>
            <form onSubmit={save} className="flex flex-col gap-5">

              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Balance</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-white/40">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    required
                    placeholder="0"
                    className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] pl-8 pr-4 py-4 text-[15px] font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25 [color-scheme:dark]"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Next payday</span>
                <input
                  type="date"
                  value={payday}
                  min={minDateStr}
                  onChange={e => setPayday(e.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 py-4 text-[15px] font-semibold text-white outline-none transition-all duration-200 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25 [color-scheme:dark]"
                />
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Pay cycle</span>
                <div className="grid grid-cols-2 gap-2">
                  {FREQUENCIES.map(({ id, label, sub }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFreq(id)}
                      className={`flex flex-col rounded-2xl px-4 py-3.5 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                        frequency === id
                          ? 'bg-emerald-500 shadow-[0_8px_24px_rgba(16,185,129,0.18)]'
                          : 'border border-white/[0.09] bg-white/[0.04] hover:bg-white/[0.07]'
                      }`}
                    >
                      <span className={`text-sm font-black ${frequency === id ? 'text-white' : 'text-white/75'}`}>
                        {label}
                      </span>
                      <span className={`mt-0.5 text-[11px] font-semibold ${frequency === id ? 'text-white/65' : 'text-white/30'}`}>
                        {sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm font-semibold text-rose-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {saving
                  ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  : saved
                    ? '✓ Saved'
                    : 'Save changes'}
              </button>

            </form>
          </div>
        </section>

        {/* Notifications */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Notifications</div>
          <NotificationCard />
        </section>

        {/* Sign out */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Danger zone</div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-4 text-sm font-bold text-rose-400 transition-all duration-200 hover:scale-[1.02] hover:bg-rose-500/[0.14] hover:text-rose-300 active:scale-[0.98]"
          >
            Sign out
          </button>
        </section>

      </div>
    </AppShell>
  )
}
