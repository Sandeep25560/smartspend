import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../services/api'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
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
    <div className="flex min-h-screen flex-col bg-slate-950 pt-12 pb-10">
      <div className="mx-auto w-full max-w-md px-6">
        <button
          onClick={() => navigate('/')}
          className="mb-6 text-left text-sm font-medium text-white/60 transition-all duration-200 hover:text-white active:scale-[0.98]"
        >
          &larr; Back
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-white mb-2">Welcome back</h2>
          <p className="text-white/60">Get your answer before you spend.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white outline-none transition-all duration-200 placeholder:text-white/30 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Your password"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-white outline-none transition-all duration-200 placeholder:text-white/30 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40"
            />
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white shadow-[0_12px_30px_rgba(16,185,129,0.18)] transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Log in'}
          </button>
        </form>

        <p className="text-white/50 text-sm text-center mt-8">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-emerald-300 transition-colors duration-200 hover:text-emerald-200">Sign up free</Link>
        </p>
      </div>
    </div>
  )
}
