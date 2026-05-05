/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          900: '#07070d',
          800: '#0d0d18',
          700: '#161628',
          600: '#1f1f36',
        },
        neon: {
          cyan: '#22d3ee',
          pink: '#f472b6',
          violet: '#a78bfa',
          lime: '#a3e635',
          amber: '#fbbf24',
        },
      },
      boxShadow: {
        glow: '0 0 24px rgba(34, 211, 238, 0.45)',
        'glow-pink': '0 0 24px rgba(244, 114, 182, 0.5)',
        'glow-violet': '0 0 24px rgba(167, 139, 250, 0.5)',
      },
      fontFamily: {
        display: ['"Orbitron"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
