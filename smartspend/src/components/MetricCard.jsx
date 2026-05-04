import { ui } from '../utils/designSystem'

export default function MetricCard({ label, value, accent }) {
  return (
    <div className={`${ui.card} ${ui.cardPad}`}>
      <div
        className="text-[30px] font-black leading-none tracking-tight"
        style={{ color: accent ?? 'rgba(255,255,255,0.90)' }}
      >
        {value}
      </div>
      <div className="mt-2 text-sm font-semibold leading-tight text-white/60">
        {label}
      </div>
    </div>
  )
}
