import { STATES } from '../utils/decisionHelpers'

export default function StatusPill({ status }) {
  const s = STATES[status] ?? STATES.safe
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${s.pill}`}>
      <span>Today: {s.pillText}</span>
    </span>
  )
}
