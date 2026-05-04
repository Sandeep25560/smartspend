import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('[SmartSpend] UI error', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center overflow-y-auto overflow-x-hidden bg-[#0b0f1a] px-6 text-white">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 px-5 py-5">
            <h1 className="text-2xl font-black tracking-tight text-white/90">Something went wrong.</h1>
            <p className="mt-3 text-sm font-medium leading-relaxed text-white/60">
              Your setup is still saved. Refresh and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-black text-white transition-all duration-200 hover:scale-[1.02] hover:bg-emerald-400 active:scale-[0.98]"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
