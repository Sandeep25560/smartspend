import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await login(form.email, form.password)
      localStorage.setItem('ss_token', token)
      localStorage.setItem('ss_user', JSON.stringify(user))
      navigate(user.onboardingCompleted ? '/home' : '/onboarding', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: '#0b0f1a' }}>
      {/* Ambient glow — matches app aesthetic */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-emerald-500/[0.07] blur-3xl" />
        <div className="absolute -bottom-20 -right-32 h-80 w-80 rounded-full bg-indigo-500/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-12 pb-10">
        {/* Header row */}
        <div className="mb-10 flex items-center justify-between">
          <span className="text-xs font-bold tracking-[0.22em] uppercase text-emerald-400">SmartSpend</span>
          <button
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-white/35 transition-colors duration-200 hover:text-white/70 active:scale-[0.97]"
          >
            ← Back
          </button>
        </div>

        {/* Hero */}
        <div className="mb-8 animate-fadeIn">
          <h1 className="text-[32px] font-black leading-tight tracking-tight text-white">
            Welcome back.
          </h1>
          <p className="mt-2 text-[15px] font-medium text-white/45">
            Get your answer before you spend.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex flex-col gap-4 animate-fadeIn">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 py-4 text-[15px] font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25 [color-scheme:dark]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Your password"
              className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 py-4 text-[15px] font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25 [color-scheme:dark]"
            />
          </label>

          {error && (
            <div className="animate-panelIn rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm font-semibold text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.18)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading
              ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              : 'Sign in'}
          </button>

          <Link
            to="/forgot-password"
            className="block text-center text-sm font-semibold text-white/35 transition-colors duration-200 hover:text-white/60"
          >
            Forgot your password?
          </Link>
        </form>

        <p className="mt-8 text-center text-sm font-medium text-white/35">
          No account?{' '}
          <Link
            to="/signup"
            className="font-bold text-emerald-400 transition-colors duration-200 hover:text-emerald-300"
          >
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  )
}
