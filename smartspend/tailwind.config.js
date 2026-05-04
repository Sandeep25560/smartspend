/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif'],
      },
      keyframes: {
        pop: {
          '0%':   { transform: 'scale(0.75)', opacity: '0' },
          '60%':  { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        yesGlow: {
          '0%':   { transform: 'scale(0.985)', opacity: '0', filter: 'drop-shadow(0 0 0 rgba(52,211,153,0))' },
          '58%':  { transform: 'scale(1.01)', opacity: '1', filter: 'drop-shadow(0 0 14px rgba(52,211,153,0.12))' },
          '100%': { transform: 'scale(1)', opacity: '1', filter: 'drop-shadow(0 0 8px rgba(52,211,153,0.07))' },
        },
        softPulse: {
          '0%':   { transform: 'scale(0.94)', opacity: '0' },
          '55%':  { transform: 'scale(1.02)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        waitPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%':      { transform: 'scale(1.015)', opacity: '0.95' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '14%':     { transform: 'translateX(-3px)' },
          '30%':     { transform: 'translateX(3px)' },
          '46%':     { transform: 'translateX(-2px)' },
          '62%':     { transform: 'translateX(2px)' },
          '78%':     { transform: 'translateX(-1px)' },
        },
        inputBump: {
          '0%,100%': { transform: 'scale(1)' },
          '45%':     { transform: 'scale(1.04)' },
        },
        riseIn: {
          '0%':   { transform: 'translateY(7px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        messageIn: {
          '0%':   { transform: 'translateY(5px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        panelIn: {
          '0%':   { transform: 'translateY(9px) scale(0.98)', opacity: '0' },
          '60%':  { transform: 'translateY(-1px) scale(1.002)', opacity: '1' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        chipPress: {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(0.93)' },
          '100%': { transform: 'scale(1)' },
        },
        fadeUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        pop:       'pop 0.40s cubic-bezier(0.34,1.56,0.64,1) both',
        yesGlow:   'yesGlow 0.34s cubic-bezier(0.25,0.46,0.45,0.94) both',
        softPulse: 'softPulse 0.44s cubic-bezier(0.34,1.20,0.64,1) both',
        waitPulse: 'waitPulse 3.1s ease-in-out infinite both',
        shake:     'shake 0.50s cubic-bezier(0.36,0.07,0.19,0.97) both',
        inputBump: 'inputBump 0.26s cubic-bezier(0.34,1.56,0.64,1)',
        riseIn:    'riseIn 0.30s cubic-bezier(0.25,0.46,0.45,0.94) both',
        messageIn: 'messageIn 0.26s cubic-bezier(0.25,0.46,0.45,0.94) both',
        panelIn:   'panelIn 0.32s cubic-bezier(0.34,1.20,0.64,1) both',
        chipPress: 'chipPress 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
        fadeUp:    'fadeUp 0.30s cubic-bezier(0.25,0.46,0.45,0.94) both',
        fadeIn:    'fadeIn 0.26s ease both',
      },
    },
  },
  plugins: [],
}
