import { ui } from '../utils/designSystem'

export default function StreakCard({ streak = 0 }) {
  return (
    <div className={`${ui.card} ${ui.cardPad} flex items-center justify-between`}>
      <div>
        <div className={ui.label}>Good days</div>
        <div className="mt-2 text-xl font-black tracking-tight text-white/90">
          {streak > 0
            ? `${streak} day${streak !== 1 ? 's' : ''} under control`
            : 'Start today'}
        </div>
        {streak > 0 && (
          <div className="mt-1 text-xs font-medium text-white/60">
            Keep your decisions clean.
          </div>
        )}
      </div>
      <span className="ml-4 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.28)]" />
    </div>
  )
}
