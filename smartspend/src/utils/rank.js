export const RANKS = [
  {
    level: 1,
    name: 'First Check',
    minStreak: 0,
    description: 'You checked. That\'s how it starts.',
  },
  {
    level: 2,
    name: 'Habit Starter',
    minStreak: 3,
    description: 'Three days in. Something\'s shifting.',
  },
  {
    level: 3,
    name: 'Consistent Checker',
    minStreak: 10,
    description: 'Checking before every spend. This is working.',
  },
  {
    level: 4,
    name: 'SmartSpender',
    minStreak: 21,
    description: 'You think before you spend. Most people don\'t.',
  },
  {
    level: 5,
    name: 'Budget Guardian',
    minStreak: 45,
    description: 'Six weeks in. Most people quit before this.',
  },
  {
    level: 6,
    name: 'Money Monk',
    minStreak: 90,
    description: 'You\'ve rewired how you think about money.',
  },
]

export function computeRank(streak) {
  const s = Math.max(0, streak ?? 0)
  return [...RANKS].reverse().find(r => s >= r.minStreak) ?? RANKS[0]
}

export function getNextRank(streak) {
  const s = Math.max(0, streak ?? 0)
  return RANKS.find(r => r.minStreak > s) ?? null
}
