function fmt(n) {
  const value = Number(n)
  return `$${Math.max(0, Number.isFinite(value) ? value : 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function formatAmount(amount) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '$0'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: String(amount).includes('.') ? 2 : 0,
  })
}

function ActionChip({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white/70 transition-all duration-150 ease-out hover:scale-[1.02] hover:bg-white/20 hover:text-white/90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function AppreciationPanel({ safePerDay, streak, confidenceMessage, streakIncreased }) {
  return (
    <div
      aria-live="polite"
      className="animate-panelIn rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-5 py-5"
    >
      <p className="text-2xl font-black text-emerald-300">Good call.</p>
      <p className="mt-1.5 text-sm font-semibold text-white/80">You stayed on track.</p>
      <p className="mt-3 text-sm font-semibold text-white/45">
        Still {fmt(safePerDay)} safe today.
      </p>
      {streakIncreased && streak > 0 && (
        <p className="mt-4 animate-messageIn text-xs font-semibold text-white/60">
          Streak: Day {streak} - staying on track
        </p>
      )}
      {confidenceMessage && (
        <p className="mt-1.5 animate-messageIn text-xs font-semibold text-white/60">
          {confidenceMessage}
        </p>
      )}
    </div>
  )
}

function RecoveryPanel({ amount, safePerDay, newSafePerDay, daysLeft, balance }) {
  const numAmount = Number(amount)
  const nextSafePerDay = Number.isFinite(newSafePerDay)
    ? newSafePerDay
    : daysLeft > 0
      ? Math.max(0, balance - numAmount) / daysLeft
      : 0
  const daysImpact = safePerDay > 0 ? numAmount / safePerDay : 0
  const runsOutEarly = Math.round(daysImpact) >= 1
  const avoidDays = Math.max(1, Math.ceil(Math.min(daysImpact, Math.min(daysLeft, 3))))

  return (
    <div
      aria-live="polite"
      className="animate-panelIn rounded-2xl border border-red-400/20 bg-red-500/[0.06] px-5 py-5"
    >
      <p className="text-base font-black text-white/80">This pushes you off track.</p>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/60">
          <span>Safe/day</span>
          <span className="text-white/25">-&gt;</span>
          <span className="line-through text-white/35">{fmt(safePerDay)}</span>
          <span className="text-white/25">-&gt;</span>
          <span className="text-red-300">{fmt(nextSafePerDay)}</span>
        </div>
        {runsOutEarly && (
          <p className="text-sm font-semibold text-white/55">
            You'd run out ~{Math.round(daysImpact)} day{Math.round(daysImpact) === 1 ? '' : 's'} early.
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
          To stay on track
        </p>
        <ul className="mt-2 space-y-1.5 text-sm font-semibold text-white/60">
          <li>- Spend {fmt(nextSafePerDay)}/day from now</li>
          <li>- Avoid extra spending for {avoidDays} day{avoidDays === 1 ? '' : 's'}</li>
        </ul>
      </div>
    </div>
  )
}

export default function ActionPrompt({
  amount,
  mode,
  spent,
  onRespond,
  safePerDay,
  newSafePerDay,
  daysLeft,
  balance,
  streak = 0,
  confidenceMessage = '',
  streakIncreased = false,
  personalizationMessage = '',
  loading = false,
}) {
  if (mode === 'hidden') return null

  if (mode === 'answered') {
    return (
      <div className="mt-5 min-h-[194px] transition-all duration-200 ease-out">
        {spent === false ? (
          <AppreciationPanel
            safePerDay={safePerDay}
            streak={streak}
            confidenceMessage={confidenceMessage}
            streakIncreased={streakIncreased}
          />
        ) : (
          <RecoveryPanel
            amount={amount}
            safePerDay={safePerDay}
            newSafePerDay={newSafePerDay}
            daysLeft={daysLeft}
            balance={balance}
          />
        )}
      </div>
    )
  }

  const isFallback = mode === 'fallback'

  return (
    <div className="mt-5 min-h-[194px] transition-all duration-200 ease-out">
      <div
        aria-live="polite"
        className="animate-panelIn rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl"
      >
        <div className="flex flex-col gap-3">
          <div>
            {personalizationMessage && (
              <p className="mb-2 animate-messageIn text-xs font-semibold text-white/50">
                {personalizationMessage}
              </p>
            )}
            {isFallback && (
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
                Quick check:
              </div>
            )}
            <p className="text-sm font-semibold text-white/70">
              {isFallback ? `Did you spend ${formatAmount(amount)}?` : 'What did you do?'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ActionChip onClick={() => onRespond(true)} disabled={loading}>I spent it</ActionChip>
            <ActionChip onClick={() => onRespond(false)} disabled={loading}>I didn't</ActionChip>
          </div>
        </div>
      </div>
    </div>
  )
}
