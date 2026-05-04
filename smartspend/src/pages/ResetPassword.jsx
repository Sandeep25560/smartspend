import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { resetPassword } from '../services/api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!token) setError('Invalid reset link. Request a new one.')
  }, [token])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }

    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
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
        </div>

        {done ? (
          <div className="animate-fadeIn flex flex-1 flex-col justify-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] text-2xl">
              ✓
            </div>
            <h1 className="text-[32px] font-black leading-tight tracking-tight text-white">
              Password updated.
            </h1>
            <p className="mt-3 text-[15px] font-medium text-white/50">
              You can now sign in with your new password.
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-8 w-full rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.16)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98]"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="animate-fadeIn flex flex-1 flex-col">
            <div className="flex-1">
              <h1 className="text-[32px] font-black leading-tight tracking-tight text-white">
                Set a new<br />password.
              </h1>
              <p className="mt-3 mb-8 text-[15px] font-medium text-white/45">
                Must be at least 6 characters.
              </p>

              <form onSubmit={submit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">New password</span>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 py-4 text-[15px] font-semibold text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:border-emerald-400/60 focus:bg-white/[0.07] focus:ring-1 focus:ring-emerald-400/25 [color-scheme:dark]"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Confirm password</span>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repeat password"
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
                  disabled={loading || !token}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-[15px] font-black text-white shadow-[0_12px_30px_rgba(16,185,129,0.18)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading
                    ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    : 'Update password'}
                </button>
              </form>
            </div>

            <p className="mt-8 text-center text-sm font-medium text-white/35">
              Remember your password?{' '}
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
