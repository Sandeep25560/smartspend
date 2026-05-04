import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { forgotPassword } from '../services/api'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: '#0b0f1a' }}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-500/[0.06] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-12 pb-10">
        <div className="mb-10 flex items-center justify-between">
          <span className="text-xs font-bold tracking-[0.22em] uppercase text-emerald-400">SmartSpend</span>
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-semibold text-white/35 transition-colors duration-200 hover:text-white/70 active:scale-[0.97]"
          >
            ← Back
          </button>
        </div>

        {sent ? (
          <div className="animate-fadeIn flex flex-1 flex-col justify-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] text-2xl">
              ✉️
            </div>
            <h1 className="text-[32px] font-black leading-tight tracking-tight text-white">
              Check your email.
            </h1>
            <p className="mt-3 text-[15px] font-medium leading-relaxed text-white/50">
              If <span className="text-white/80">{email}</span> is registered, a reset link is on its way. It expires in 1 hour.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-8 w-full rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98]"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="animate-fadeIn flex flex-1 flex-col">
            <div className="flex-1">
              <h1 className="text-[32px] font-black leading-tight tracking-tight text-white">
                Forgot your<br />password?
              </h1>
              <p className="mt-3 mb-8 text-[15px] font-medium text-white/45">
                Enter your email and we'll send a reset link.
              </p>

              <form onSubmit={submit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Email</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
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
                  disabled={loading || !email}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.18)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading
                    ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    : 'Send reset link'}
                </button>
              </form>
            </div>

            <p className="mt-8 text-center text-sm font-medium text-white/35">
              Remembered it?{' '}
              <Link to="/login" className="font-bold text-emerald-400 transition-colors duration-200 hover:text-emerald-300">
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
