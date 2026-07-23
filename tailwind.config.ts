import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#faf6f0',
          100: '#f3eadc',
          200: '#e7d5bb',
          300: '#d8bb95',
          400: '#c7a172',
          500: '#b88f5f',
          600: '#a68a65',
          700: '#856d4e',
          800: '#6a563d',
          900: '#4a3b2a',
        },
      },
    },
  },
  plugins: [],
}
export default config
