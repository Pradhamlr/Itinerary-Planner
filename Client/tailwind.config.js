/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Plus Jakarta Sans', 'sans-serif'],
        sans: ['Inter', 'Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          surface: '#f8f9fa',
          surfaceLow: '#f3f4f5',
          surfaceHigh: '#e7e8e9',
          surfaceLowest: '#ffffff',
          palm: '#000514',
          palmContainer: '#001e43',
          terracotta: '#0d9488',
          terracottaInk: '#ffffff',
          secondary: '#00696b',
          secondarySoft: '#56f5f8',
          outline: '#74777f',
          outlineVariant: '#c4c6cf',
          onSurface: '#191c1d',
          onSurfaceVariant: '#43474e',
          primaryFixedDim: '#a9c7ff',
        },
      },
      boxShadow: {
        ambient: '0 8px 24px -4px rgba(25, 28, 29, 0.08)',
        soft: '0 14px 30px -12px rgba(25, 28, 29, 0.08)',
      },
    },
  },
  plugins: [],
}

