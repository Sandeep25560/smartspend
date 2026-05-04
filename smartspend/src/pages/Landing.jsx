import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

const STATUS_CARDS = [
  {
    dot: '#34d399',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.07]',
    label: "You're good",
    sub: 'Go for it.',
    delay: '60ms',
  },
  {
    dot: '#fbbf24',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.07]',
    label: 'Hold on',
    sub: 'Think before you tap pay.',
    delay: '140ms',
  },
  {
    dot: '#f87171',
    border: 'border-rose-500/20',
    bg: 'bg-rose-500/[0.07]',
    label: 'Skip this',
    sub: 'Not today — wait it out.',
    delay: '220ms',
  },
]

export default function Landing() {
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('ss_token')) navigate('/home', { replace: true })
  }, [navigate])

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: '#0b0f1a' }}>
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/[0.08] blur-3xl" />
        <div className="absolute top-1/2 -right-32 h-80 w-80 rounded-full bg-amber-500/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-12 pb-10">

        {/* Wordmark */}
        <div className="mb-16">
          <span className="text-xs font-bold tracking-[0.22em] uppercase text-emerald-400">SmartSpend</span>
        </div>

        <div className="flex-1 flex flex-col justify-center">

          {/* Hero */}
          <div className="animate-fadeIn mb-10">
            <h1 className="text-[44px] font-black leading-[1.08] tracking-tight text-white">
              Know before<br />
              <span className="text-emerald-300">you spend.</span>
            </h1>
            <p className="mt-4 text-[16px] font-medium leading-relaxed text-white/50">
              Every other app shows the damage after.<br />
              SmartSpend answers before — in 5 seconds.
            </p>
          </div>

          {/* Status preview cards — staggered */}
          <div className="flex flex-col gap-2">
            {STATUS_CARDS.map(({ dot, border, bg, label, sub, delay }) => (
              <div
                key={label}
                className={`animate-fadeUp flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 ${border} ${bg}`}
                style={{ animationDelay: delay, animationFillMode: 'both' }}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: dot, boxShadow: `0 0 8px ${dot}66` }}
                />
                <div>
                  <div className="text-sm font-black text-white/90">{label}</div>
                  <div className="text-xs font-medium text-white/50">{sub}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.20em] text-white/25">
            The check before every spend
          </p>

        </div>

        {/* CTA buttons */}
        <div className="mt-12 flex flex-col gap-3">
          <button
            onClick={() => navigate('/signup')}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.18)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98]"
          >
            Get started — it's free
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.04] py-3.5 text-[15px] font-semibold text-white/65 transition-all duration-200 hover:scale-[1.02] hover:bg-white/[0.07] hover:text-white/85 active:scale-[0.98]"
          >
            I already have an account
          </button>
        </div>

      </div>
    </div>
  )
}
