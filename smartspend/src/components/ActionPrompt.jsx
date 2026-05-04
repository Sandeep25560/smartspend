import { useState } from 'react'

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

const TAGS = ['Food', 'Transport', 'Bills', 'Shopping', 'Fun', 'Other']

function TagChips({ actionId, onTag }) {
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function tap(tag) {
    if (selected || saving) return
    setSelected(tag)
    setSaving(true)
    setError('')

    if (actionId && onTag) {
      onTag(actionId, tag)
        .catch(() => {
          setSelected(null)
          setError("Couldn't save that.")
        })
        .finally(() => setSaving(false))
    } else {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 border-t border-white/[0.07] pt-4">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-white/30">What was it for?</p>
      <div className="flex flex-wrap gap-1.5">
        {TAGS.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => tap(tag)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-all duration-150 ${
              selected === tag
                ? 'bg-white/20 text-white/90'
                : selected
                  ? 'opacity-30 cursor-default border border-white/10 text-white/40'
                  : 'border border-white/10 bg-white/[0.05] text-white/50 hover:bg-white/[0.10] hover:text-white/75 active:scale-[0.96]'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-[11px] font-semibold text-rose-300/80">{error}</p>
      )}
    </div>
  )
}

function RecoveryPanel({ amount, safePerDay, newSafePerDay, daysLeft, balance }) {
  const numAmount = Number(amount)
  const nextSafePerDay = Number.isFinite(newSafePerDay) && newSafePerDay > 0
    ? newSafePerDay
    : daysLeft > 0
      ? Math.max(0, balance - numAmount) / daysLeft
      : 0

  return (
    <div
      aria-live="polite"
      className="animate-panelIn rounded-2xl border border-red-400/20 bg-red-500/[0.06] px-5 py-5"
    >
      <p className="text-lg font-black text-white/85">Off track.</p>
      <p className="mt-2 text-[15px] font-bold" style={{ color: '#f87171' }}>
        Stay under {fmt(nextSafePerDay)}/day to recover.
      </p>
      <p className="mt-1.5 text-sm font-semibold text-white/40">
        {daysLeft} day{daysLeft === 1 ? '' : 's'} left until payday.
      </p>
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
  lastActionId = null,
  onTag,
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
          <>
            <RecoveryPanel
              amount={amount}
              safePerDay={safePerDay}
              newSafePerDay={newSafePerDay}
              daysLeft={daysLeft}
              balance={balance}
            />
            {lastActionId && (
              <div className="animate-messageIn rounded-b-2xl px-1">
                <TagChips actionId={lastActionId} onTag={onTag} />
              </div>
            )}
          </>
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
