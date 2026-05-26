import animatePlugin from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        page: '#f4f6f5', // soft sage-grey page background
        surface: '#ffffff',
        'surface-muted': '#f8fafc', // slate-50

        // Carbon intensity stops
        carbon: {
          'very-low': '#10b981', // emerald-500
          low: '#34d399', // emerald-400
          moderate: '#f59e0b', // amber-500
          high: '#f97316', // orange-500
          'very-high': '#dc2626', // red-600
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        'tighter-2': '-0.04em',
      },
      boxShadow: {
        // Subtle resting shadow for cards
        soft: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        // Hover lift
        lift: '0 10px 30px -12px rgb(0 0 0 / 0.10), 0 4px 12px -4px rgb(0 0 0 / 0.06)',
        // Emerald focus halo
        ring: '0 0 0 4px rgb(16 185 129 / 0.12)',
        // Inset for inputs
        'inset-soft': 'inset 0 1px 2px 0 rgb(0 0 0 / 0.03)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'draw-ring': {
          // Starts hidden (full circumference), ends at final offset (set per-element via CSS var)
          '0%': { strokeDashoffset: 'var(--ring-circumference, 251.2)' },
          '100%': { strokeDashoffset: 'var(--ring-final-offset, 0)' },
        },
        'pulse-ring': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0', transform: 'scale(2.4)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'soft-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 400ms ease-out both',
        'scale-in': 'scale-in 250ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'draw-ring': 'draw-ring 900ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'soft-bounce': 'soft-bounce 2s ease-in-out infinite',
      },
      backgroundImage: {
        // Hatch pattern used for high-carbon zones in chart
        'hatch-amber':
          'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(245,158,11,0.18) 4px, rgba(245,158,11,0.18) 5px)',
        'hatch-emerald':
          'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(16,185,129,0.14) 4px, rgba(16,185,129,0.14) 5px)',
        // Shimmer for skeleton
        skeleton: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
      },
    },
  },
  plugins: [animatePlugin],
};
