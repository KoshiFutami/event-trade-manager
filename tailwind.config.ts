import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#08080f',
          surface: '#0f0f1a',
          elevated: '#161624',
          border: '#1e1e30',
        },
        text: {
          primary: '#e2e8f0',
          secondary: '#6b7280',
          muted: '#374151',
        },
        brand: {
          blue: '#3b82f6',
          green: '#10b981',
          red: '#ef4444',
          amber: '#f59e0b',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
