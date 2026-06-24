/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        navy: '#050040',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        pulse_ring: {
          '0%':   { transform: 'scale(1)',    opacity: '0.8' },
          '70%':  { transform: 'scale(1.35)', opacity: '0'   },
          '100%': { transform: 'scale(1.35)', opacity: '0'   },
        },
      },
      animation: {
        pulse_ring: 'pulse_ring 1.4s cubic-bezier(0.24,0,0.38,1) infinite',
      },
    },
  },
  plugins: [],
}
