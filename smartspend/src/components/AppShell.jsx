import BottomNav from './BottomNav'
import { appBackground, ui } from '../utils/designSystem'

export default function AppShell({ children, tint, loading = false }) {
  if (loading) {
    return (
      <div className={ui.screen}>
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: appBackground(tint) }}
        />
        <div className="relative z-10 flex min-h-screen items-center justify-center">
          <span className="w-6 h-6 rounded-full border-2 border-white/10 border-t-emerald-400 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className={ui.screen}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: appBackground(tint) }}
      />
      <div className={ui.container}>
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
