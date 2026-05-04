import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Landing() {
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('ss_token')) navigate('/home', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-80 h-80 bg-amber-500/[0.08] rounded-full blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-16 pb-10">
        <div className="mb-16">
          <span className="text-xs font-bold tracking-[0.2em] text-emerald-400 uppercase">SmartSpend</span>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight mb-5">
            Will you run out<br />
            <span className="text-emerald-300">before payday?</span>
          </h1>
          <p className="text-white/60 text-lg leading-relaxed mb-12">
            Know in seconds before you spend. No budgets, no stress. Just a clear answer.
          </p>

          <div className="space-y-2 mb-12">
            {[
              { status: 'bg-emerald-500/[0.15] border-emerald-500/20 text-emerald-300', dot: '#34d399', label: "You're good", sub: 'Looks good. Go for it.' },
              { status: 'bg-amber-500/[0.15] border-amber-500/20 text-amber-300', dot: '#fbbf24', label: 'Go slow', sub: 'Not the best move right now.' },
              { status: 'bg-rose-500/[0.15] border-rose-500/20 text-rose-300', dot: '#f87171', label: 'Skip this', sub: 'You may run out early.' },
            ].map(({ status, dot, label, sub }) => (
              <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${status}`}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dot }} />
                <div>
                  <div className="text-sm font-bold">{label}</div>
                  <div className="text-xs text-white/60">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/signup')}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white shadow-[0_12px_30px_rgba(16,185,129,0.18)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98]"
          >
            Get started
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full rounded-xl border border-white/[0.15] bg-white/5 py-3 text-base font-semibold text-white/80 transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98]"
          >
            I already have an account &rarr;
          </button>
        </div>
      </div>
    </div>
  )
}
