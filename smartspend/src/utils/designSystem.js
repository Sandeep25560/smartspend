export const statusTheme = {
  safe: {
    word: 'YES',
    label: "You're good",
    color: '#34d399',
    text: 'text-emerald-300',
    muted: 'text-emerald-300/70',
    gradient: 'from-emerald-300 to-green-500',
    tint: '#071f17',
    rgb: '52,211,153',
  },
  careful: {
    word: 'WAIT',
    label: 'Go slow',
    color: '#fbbf24',
    text: 'text-amber-300',
    muted: 'text-amber-300/70',
    gradient: 'from-amber-300 to-orange-500',
    tint: '#2a1a00',
    rgb: '251,191,36',
  },
  stop: {
    word: 'NO',
    label: 'Skip this',
    color: '#f87171',
    text: 'text-red-300',
    muted: 'text-red-300/70',
    gradient: 'from-red-400 to-red-600',
    tint: '#1a0b0b',
    rgb: '248,113,113',
  },
}

export const ui = {
  screen: 'relative h-screen overflow-y-auto overflow-x-hidden no-scrollbar bg-[#0b0f1a] flex flex-col text-white',
  container: 'relative z-10 max-w-md mx-auto w-full flex-1 px-6 pt-12 pb-28 animate-fadeIn',
  stack: 'flex flex-col gap-4',
  sectionGap: 'flex flex-col gap-6',
  eyebrow: 'text-[11px] font-semibold tracking-[0.20em] uppercase text-white/50',
  title: 'text-[28px] font-black tracking-tight leading-none text-white/90',
  subtitle: 'text-sm font-medium leading-relaxed text-white/60',
  card: 'rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl shadow-[0_14px_44px_rgba(0,0,0,0.22)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]',
  cardPad: 'px-5 py-5',
  label: 'block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50',
  input: 'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-[15px] font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/30 focus:border-emerald-400 focus:bg-white/[0.06] focus:ring-1 focus:ring-emerald-400/40 [color-scheme:dark]',
  buttonPrimary: 'w-full rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.18)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100',
  buttonGhost: 'rounded-xl border border-white/[0.15] bg-white/5 px-3 py-2 text-xs font-bold text-white/80 transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98]',
}

export function appBackground(tint = '#07111c') {
  return `
    linear-gradient(180deg, rgba(11,15,26,0.94) 0%, rgba(11,15,26,0.88) 52%, ${tint}38 100%),
    radial-gradient(ellipse 70% 34% at 50% -4%, rgba(52,211,153,0.08) 0%, transparent 68%),
    radial-gradient(ellipse 60% 42% at 100% 18%, rgba(251,191,36,0.035) 0%, transparent 62%),
    radial-gradient(ellipse 60% 34% at 0% 100%, rgba(248,113,113,0.04) 0%, transparent 70%)
  `
}
