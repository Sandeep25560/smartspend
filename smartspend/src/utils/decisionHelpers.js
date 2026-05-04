export const STATES = {
  safe: {
    bg:       'from-emerald-50 to-green-100',
    cardBg:   'bg-white/75',
    label:    "You're good",
    emoji:    '🟢',
    color:    'text-emerald-600',
    pill:     'bg-emerald-100 text-emerald-700',
    pillText: 'Good',
    track:    '#6ee7b7',
    messages: [
      "You're good to go.",
      "This fits today.",
      "You've got room.",
      "This feels safe.",
    ],
  },
  careful: {
    bg:       'from-amber-50 to-yellow-100',
    cardBg:   'bg-white/75',
    label:    'Go slow',
    emoji:    '🟡',
    color:    'text-amber-600',
    pill:     'bg-amber-100 text-amber-700',
    pillText: 'Tight',
    track:    '#fcd34d',
    messages: [
      "This might stretch you.",
      "Give this one a pause.",
      "Possible, but tight.",
      "Better to wait.",
    ],
  },
  stop: {
    bg:       'from-rose-50 to-red-100',
    cardBg:   'bg-white/75',
    label:    'Skip this',
    emoji:    '🔴',
    color:    'text-rose-600',
    pill:     'bg-rose-100 text-rose-600',
    pillText: 'Skip',
    track:    '#fca5a5',
    messages: [
      "This will hurt your week.",
      "Skip this for now.",
      "Protect your week.",
      "This leaves you short.",
    ],
  },
}

function toLocalDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

export function computeDecision(balance, nextPayday, amount) {
  const rawDaysLeft = daysUntilPayday(nextPayday)
  const daysLeft   = Math.max(1, rawDaysLeft)
  const safePerDay = Math.max(0, balance) / daysLeft
  const impactDays = safePerDay > 0 ? amount / safePerDay : 0
  const status     = rawDaysLeft <= 0          ? 'stop'
                   : balance <= 0              ? 'stop'
                   : amount > balance          ? 'stop'
                   : amount > safePerDay * 1.3 ? 'stop'
                   : amount > safePerDay       ? 'careful'
                   : 'safe'
  return { status, safePerDay, daysLeft, impactDays }
}

export function todayStatus(balance, nextPayday) {
  if (!nextPayday) return 'safe'
  if (daysUntilPayday(nextPayday) <= 0 || balance <= 0) return 'stop'
  const { status } = computeDecision(balance, nextPayday, dailySafeAmount(balance, nextPayday) * 0.8)
  return status
}

export function dailySafeAmount(balance, nextPayday) {
  const daysLeft = Math.max(1, daysUntilPayday(nextPayday))
  return Math.max(0, balance) / daysLeft
}

export function daysUntilPayday(nextPayday) {
  if (!nextPayday) return 0

  const today = new Date()
  const payday = toLocalDate(nextPayday)
  today.setHours(0, 0, 0, 0)
  payday.setHours(0, 0, 0, 0)

  return Math.ceil((payday - today) / 86400000)
}

export function randomMessage(status) {
  const msgs = STATES[status]?.messages ?? []
  return msgs[Math.floor(Math.random() * msgs.length)] ?? ''
}

// Returns how many days to wait before this amount fits the daily budget.
// Returns null if amount > balance (can't afford this period) or already affordable.
export function daysUntilAffordable(balance, daysLeft, amount) {
  if (!amount || amount <= 0 || amount > balance) return null
  const safePerDay = balance / Math.max(1, daysLeft)
  if (amount <= safePerDay) return null // already within budget, shouldn't be 'stop'
  const d = Math.ceil(daysLeft - balance / amount)
  if (d <= 0 || d >= daysLeft) return null
  return d
}
