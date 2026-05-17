import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif']
      },
      letterSpacing: {
        cosmic: '0.42em',
        wider2: '0.22em'
      },
      colors: {
        deep: '#04060c',
        stardust: '#cbd5e1',
        nebula: '#7aa2ff'
      },
      animation: {
        'pulse-slow': 'pulse 4.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }
    }
  },
  plugins: []
};

export default config;
