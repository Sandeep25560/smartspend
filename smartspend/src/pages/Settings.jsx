import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import NotificationCard from '../components/NotificationCard'
import {
  logout,
  updateProfile,
  deleteAccount,
  getExpenses,
  addExpense,
  deleteExpense,
  joinSharedPlan,
  exportActionsCsv,
} from '../services/api'
import { useUser } from '../context/UserContext'
import { ui } from '../utils/designSystem'
import { daysUntilPayday } from '../utils/decisionHelpers'

const FREQUENCIES = [
  { id: 'Weekly',    label: 'Weekly',    sub: 'Every week' },
  { id: 'Biweekly', label: 'Biweekly',  sub: 'Every 2 weeks' },
  { id: 'Monthly',  label: 'Monthly',   sub: 'Once a month' },
  { id: 'Irregular', label: 'Irregular', sub: 'No fixed date' },
]

function money(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, setUser, refresh, syncError } = useUser()
  const [cardBalance, setCardBalance] = useState((user?.cardBalance ?? user?.balance ?? '').toString())
  const [cashBalance, setCashBalance] = useState((user?.cashBalance ?? 0).toString())
  const [activePot, setActivePot] = useState(user?.activePot ?? 'card')
  const [payday, setPayday] = useState(user?.nextPayday ? user.nextPayday.split('T')[0] : '')
  const [frequency, setFreq] = useState(user?.payFrequency ?? 'Monthly')
  const [loading, setLoading] = useState(!user)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleting, setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [expenses, setExpenses] = useState([])
  const [expenseName, setExpenseName] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDay, setExpenseDay] = useState('1')
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [expenseError, setExpenseError] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [shareSaving, setShareSaving] = useState(false)
  const [shareError, setShareError] = useState('')
  const [exporting, setExporting] = useState(false)

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
        setCardBalance((u.cardBalance ?? u.balance ?? '').toString())
        setCashBalance((u.cashBalance ?? 0).toString())
        setActivePot(u.activePot ?? 'card')
        setPayday(u.nextPayday ? u.nextPayday.split('T')[0] : '')
        setFreq(u.payFrequency ?? 'Monthly')
      })
      .catch((err) => {
        if (!localStorage.getItem('ss_token')) { navigate('/login', { replace: true }); return }
        setError(err.message || 'Could not load your setup.')
      })
      .finally(() => setLoading(false))

    getExpenses()
      .then(setExpenses)
      .catch(() => setExpenseError('Could not load recurring expenses.'))
  }, [navigate, refresh])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const parsedCardBalance = parseFloat(cardBalance)
      const parsedCashBalance = parseFloat(cashBalance || '0')
      if (!Number.isFinite(parsedCardBalance) || parsedCardBalance < 0
        || !Number.isFinite(parsedCashBalance) || parsedCashBalance < 0)
        throw new Error('Balance must be $0 or more.')
      if (!payday || daysUntilPayday(payday) <= 0)
        throw new Error('Choose a future payday.')

      const u = await updateProfile({
        cardBalance: parsedCardBalance,
        cashBalance: parsedCashBalance,
        activePot,
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

  async function saveExpense(e) {
    e.preventDefault()
    setExpenseSaving(true)
    setExpenseError('')

    try {
      const amount = parseFloat(expenseAmount)
      const day = parseInt(expenseDay, 10)

      if (!expenseName.trim()) throw new Error('Add a short name.')
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be more than $0.')
      if (!Number.isInteger(day) || day < 1 || day > 28) throw new Error('Use a day from 1 to 28.')

      const created = await addExpense(expenseName.trim(), amount, day)
      setExpenses(current => [...current, created].sort((a, b) => a.dayOfMonth - b.dayOfMonth))
      setExpenseName('')
      setExpenseAmount('')
      setExpenseDay('1')

      const fresh = await refresh()
      setUser(fresh)
    } catch (err) {
      setExpenseError(err.message || 'Could not save expense.')
    } finally {
      setExpenseSaving(false)
    }
  }

  async function removeExpense(id) {
    setExpenseError('')
    const previous = expenses
    setExpenses(current => current.filter(expense => expense.id !== id))

    try {
      await deleteExpense(id)
      const fresh = await refresh()
      setUser(fresh)
    } catch (err) {
      setExpenses(previous)
      setExpenseError(err.message || 'Could not delete expense.')
    }
  }

  async function joinPlan(e) {
    e.preventDefault()
    setShareSaving(true)
    setShareError('')

    try {
      const updated = await joinSharedPlan(joinCode)
      setUser(updated)
      setCardBalance((updated.cardBalance ?? updated.balance ?? '').toString())
      setCashBalance((updated.cashBalance ?? 0).toString())
      setActivePot(updated.activePot ?? 'card')
      setPayday(updated.nextPayday ? updated.nextPayday.split('T')[0] : '')
      setFreq(updated.payFrequency ?? 'Monthly')
      setJoinCode('')
      const list = await getExpenses()
      setExpenses(list)
    } catch (err) {
      setShareError(err.message || 'Could not join that shared plan.')
    } finally {
      setShareSaving(false)
    }
  }

  async function downloadCsv() {
    setShareError('')
    setExporting(true)

    try {
      await exportActionsCsv()
    } catch (err) {
      setShareError(err.message || 'Could not export your data.')
    } finally {
      setExporting(false)
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
          <div className={ui.eyebrow}>Your plan</div>
          <h1 className={`${ui.title} mt-3`}>Keep it true.</h1>
          <p className={`${ui.subtitle} mt-3`}>
            These numbers power every check. Keep them accurate.
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

        {/* Shared mode + export */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Shared</div>
          <div className={`${ui.card} ${ui.cardPad}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-white/90">Same plan, same balance.</p>
                <p className="mt-1 text-xs font-semibold text-white/50">
                  Share this code with someone you trust.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.09] bg-white/[0.05] px-3 py-2 text-sm font-black tracking-[0.16em] text-emerald-300">
                {user.shareCode ?? '...'}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3">
              <span className="text-xs font-semibold text-white/55">
                {user.isShared ? `Shared with ${user.sharedMemberCount} people` : 'Only you can see this plan'}
              </span>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={exporting}
                className="rounded-xl border border-white/[0.10] bg-white/[0.06] px-3 py-2 text-xs font-black text-white/70 transition-all duration-200 hover:bg-white/[0.10] hover:text-white/90 active:scale-[0.98] disabled:opacity-45"
              >
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>

            <form onSubmit={joinPlan} className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter share code"
                className="min-w-0 rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-white outline-none transition-all duration-200 placeholder:normal-case placeholder:tracking-normal placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25"
              />
              <button
                type="submit"
                disabled={shareSaving || joinCode.trim().length < 6}
                className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.12] px-4 py-3 text-sm font-black text-emerald-300 transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-500/[0.18] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
              >
                {shareSaving ? 'Joining...' : 'Join'}
              </button>
            </form>

            {shareError && (
              <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-300">
                {shareError}
              </p>
            )}
          </div>
        </section>

        {/* Your setup */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Your setup</div>
          <div className={`${ui.card} ${ui.cardPad}`}>
            <form onSubmit={save} className="flex flex-col gap-5">

              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Your pots</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['card', 'Card', cardBalance, setCardBalance],
                    ['cash', 'Cash', cashBalance, setCashBalance],
                  ].map(([pot, label, value, setter]) => (
                    <label key={pot} className="flex flex-col gap-2">
                      <span className="text-xs font-bold text-white/55">{label}</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-white/35">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={value}
                          onChange={e => setter(e.target.value)}
                          required={pot === 'card'}
                          placeholder="0"
                          className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] py-4 pl-7 pr-3 text-[15px] font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25 [color-scheme:dark]"
                        />
                      </div>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 rounded-2xl border border-white/[0.08] bg-black/20 p-1">
                  {[
                    ['card', 'Check card'],
                    ['cash', 'Check cash'],
                  ].map(([pot, label]) => (
                    <button
                      key={pot}
                      type="button"
                      onClick={() => setActivePot(pot)}
                      className={`rounded-xl px-3 py-2.5 text-xs font-black transition-all duration-200 active:scale-[0.98] ${
                        activePot === pot
                          ? 'bg-white/[0.14] text-white'
                          : 'text-white/45 hover:bg-white/[0.06] hover:text-white/70'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

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

        {/* Recurring expenses */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Recurring</div>
          <div className={`${ui.card} ${ui.cardPad}`}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-white/90">Money already spoken for.</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-white/50">
                  These lower what feels safe before payday.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-bold uppercase tracking-widest text-white/30">Upcoming</div>
                <div className="mt-1 text-sm font-black text-emerald-300">
                  {money(user.upcomingExpensesTotal)}
                </div>
              </div>
            </div>

            {expenses.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {expenses.map(expense => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white/80">{expense.name}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-white/40">
                        {money(expense.amount)} on day {expense.dayOfMonth}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExpense(expense.id)}
                      className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/50 transition-all duration-200 hover:bg-white/[0.08] hover:text-white/75 active:scale-[0.98]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={saveExpense} className="grid grid-cols-[1fr_96px_72px] gap-2">
              <input
                type="text"
                value={expenseName}
                onChange={e => setExpenseName(e.target.value)}
                maxLength={50}
                placeholder="Rent"
                className="min-w-0 rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25"
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-white/35">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] py-3 pl-6 pr-3 text-sm font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25"
                />
              </div>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="28"
                value={expenseDay}
                onChange={e => setExpenseDay(e.target.value)}
                aria-label="Day of month"
                className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] px-3 py-3 text-center text-sm font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25"
              />
              <button
                type="submit"
                disabled={expenseSaving}
                className="col-span-3 flex w-full items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.06] py-3 text-sm font-black text-white/70 transition-all duration-200 hover:scale-[1.02] hover:bg-white/[0.10] hover:text-white/90 active:scale-[0.98] disabled:opacity-45 disabled:hover:scale-100"
              >
                {expenseSaving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : 'Add recurring expense'}
              </button>
            </form>

            {expenseError && (
              <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-300">
                {expenseError}
              </p>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Notifications</div>
          <NotificationCard />
        </section>

        {/* Sign out + delete */}
        <section className="flex flex-col gap-2">
          <div className={ui.eyebrow}>Danger zone</div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-4 text-sm font-bold text-rose-400 transition-all duration-200 hover:scale-[1.02] hover:bg-rose-500/[0.14] hover:text-rose-300 active:scale-[0.98]"
          >
            Sign out
          </button>

          {!deleteOpen ? (
            <button
              type="button"
              onClick={() => { setDeleteOpen(true); setDeleteError('') }}
              className="rounded-2xl border border-rose-500/10 bg-transparent px-4 py-3.5 text-sm font-semibold text-rose-500/60 transition-all duration-200 hover:border-rose-500/25 hover:text-rose-400 active:scale-[0.98]"
            >
              Delete account
            </button>
          ) : (
            <div className="animate-panelIn rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] px-4 py-4">
              <p className="text-sm font-bold text-rose-300">Permanently delete your account?</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-white/50">
                All your data — balance, history, streaks — will be gone forever. Type your email to confirm.
              </p>
              <input
                type="email"
                value={deleteEmail}
                onChange={e => setDeleteEmail(e.target.value)}
                placeholder={user?.email}
                className="mt-3 w-full rounded-xl border border-white/[0.09] bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/20 focus:border-rose-400/40 focus:ring-1 focus:ring-rose-400/20 [color-scheme:dark]"
              />
              {deleteError && (
                <p className="mt-2 text-xs font-semibold text-rose-400">{deleteError}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setDeleteOpen(false); setDeleteEmail(''); setDeleteError('') }}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] py-3 text-sm font-bold text-white/60 transition-all duration-200 hover:bg-white/[0.09] active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting || deleteEmail.trim().toLowerCase() !== user?.email}
                  onClick={async () => {
                    setDeleting(true)
                    setDeleteError('')
                    try {
                      await deleteAccount()
                      logout()
                      navigate('/', { replace: true })
                    } catch (err) {
                      setDeleteError(err.message)
                      setDeleting(false)
                    }
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500/80 py-3 text-sm font-black text-white transition-all duration-200 hover:bg-rose-500 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-rose-500/80"
                >
                  {deleting
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    : 'Delete forever'}
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </AppShell>
  )
}
