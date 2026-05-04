import { useMemo, useState } from 'react'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_SHORT = MONTHS.map(month => month.slice(0, 3))
const YEARS_PER_PAGE = 12

function parseLocalDate(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function monthStart(year, month) {
  return new Date(year, month, 1)
}

function monthEnd(year, month) {
  return new Date(year, month + 1, 0)
}

function clampMonth(year, month, min) {
  if (!min) return { year, month }
  const requested = monthStart(year, month)
  const minimum = monthStart(min.getFullYear(), min.getMonth())

  if (requested < minimum) {
    return { year: min.getFullYear(), month: min.getMonth() }
  }

  return { year, month }
}

export default function DatePicker({ value, onChange, minDate }) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const selected = parseLocalDate(value)
  const min = parseLocalDate(minDate)

  const init = selected ?? (min && min > today ? min : today)
  const [viewYear, setViewYear] = useState(init.getFullYear())
  const [viewMonth, setViewMonth] = useState(init.getMonth())
  const [pickerMode, setPickerMode] = useState('days')
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor(init.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE
  )

  function setView(year, month) {
    const next = clampMonth(year, month, min)
    setViewYear(next.year)
    setViewMonth(next.month)
  }

  function prev() {
    if (pickerMode === 'years') {
      setYearPageStart(year => Math.max(min?.getFullYear() ?? year - YEARS_PER_PAGE, year - YEARS_PER_PAGE))
      return
    }

    if (pickerMode === 'months') {
      setView(viewYear - 1, viewMonth)
      return
    }

    setView(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1)
  }

  function next() {
    if (pickerMode === 'years') {
      setYearPageStart(year => year + YEARS_PER_PAGE)
      return
    }

    if (pickerMode === 'months') {
      setView(viewYear + 1, viewMonth)
      return
    }

    setView(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1)
  }

  function togglePickerMode() {
    if (pickerMode === 'days') setPickerMode('months')
    else if (pickerMode === 'months') {
      setYearPageStart(Math.floor(viewYear / YEARS_PER_PAGE) * YEARS_PER_PAGE)
      setPickerMode('years')
    } else {
      setPickerMode('months')
    }
  }

  function selectMonth(month) {
    setView(viewYear, month)
    setPickerMode('days')
  }

  function selectYear(year) {
    setView(year, viewMonth)
    setPickerMode('months')
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, index) => yearPageStart + index)

  function dateFor(d) { return new Date(viewYear, viewMonth, d) }
  function fmt(d) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function isSelected(d) {
    if (!d || !selected) return false
    return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d
  }

  function isDisabled(d) { return !d || (min != null && dateFor(d) < min) }

  function isToday(d) {
    return d && today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d
  }

  function isMonthDisabled(month) {
    return min != null && monthEnd(viewYear, month) < min
  }

  function isYearDisabled(year) {
    return min != null && new Date(year, 11, 31) < min
  }

  const minMonth = min ? monthStart(min.getFullYear(), min.getMonth()) : null
  const canGoPrev = pickerMode === 'years'
    ? yearPageStart > (min?.getFullYear() ?? yearPageStart - YEARS_PER_PAGE)
    : pickerMode === 'months'
      ? (!min || viewYear > min.getFullYear())
      : (!minMonth || monthStart(viewYear, viewMonth) > minMonth)

  const title = pickerMode === 'years'
    ? `${yearPageStart} - ${yearPageStart + YEARS_PER_PAGE - 1}`
    : pickerMode === 'months'
      ? String(viewYear)
      : `${MONTHS[viewMonth]} ${viewYear}`

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 select-none">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prev}
          disabled={!canGoPrev}
          aria-label={pickerMode === 'days' ? 'Previous month' : pickerMode === 'months' ? 'Previous year' : 'Previous years'}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-white/70 transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98] disabled:opacity-20 disabled:hover:scale-100"
        >
          {'<'}
        </button>

        <button
          type="button"
          onClick={togglePickerMode}
          className="rounded-full px-4 py-2 text-sm font-bold tracking-wide text-white/90 transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98]"
        >
          {title}
          <span className="ml-2 text-white/40">{pickerMode === 'years' ? 'Months' : 'Change'}</span>
        </button>

        <button
          type="button"
          onClick={next}
          aria-label={pickerMode === 'days' ? 'Next month' : pickerMode === 'months' ? 'Next year' : 'Next years'}
          className="flex h-9 w-9 items-center justify-center rounded-full text-xl leading-none text-white/70 transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98]"
        >
          {'>'}
        </button>
      </div>

      {pickerMode === 'days' && (
        <div className="animate-fadeIn">
          <div className="mb-1 grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="py-1 text-center text-xs font-semibold text-white/50">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => !isDisabled(d) && d && onChange(fmt(d))}
                disabled={isDisabled(d)}
                className={`
                  mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100
                  ${!d ? '' :
                    isSelected(d) ? 'bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/30' :
                    isDisabled(d) ? 'text-white/25 cursor-not-allowed' :
                    isToday(d) ? 'text-emerald-300 ring-1 ring-emerald-500/50 hover:bg-emerald-500/20' :
                    'text-white/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {pickerMode === 'months' && (
        <div className="animate-fadeIn grid grid-cols-3 gap-2">
          {MONTH_SHORT.map((month, index) => {
            const active = index === viewMonth
            const disabled = isMonthDisabled(index)

            return (
              <button
                key={month}
                type="button"
                onClick={() => !disabled && selectMonth(index)}
                disabled={disabled}
                className={`rounded-2xl px-3 py-3 text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 ${
                  active
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : disabled
                      ? 'bg-white/[0.03] text-white/25'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {month}
              </button>
            )
          })}
        </div>
      )}

      {pickerMode === 'years' && (
        <div className="animate-fadeIn grid grid-cols-3 gap-2">
          {years.map(year => {
            const active = year === viewYear
            const disabled = isYearDisabled(year)

            return (
              <button
                key={year}
                type="button"
                onClick={() => !disabled && selectYear(year)}
                disabled={disabled}
                className={`rounded-2xl px-3 py-3 text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 ${
                  active
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                    : disabled
                      ? 'bg-white/[0.03] text-white/25'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {year}
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="mt-4 border-t border-white/10 pt-3 text-center">
          <span className="text-sm font-semibold text-emerald-300">
            {selected.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      )}
    </div>
  )
}
