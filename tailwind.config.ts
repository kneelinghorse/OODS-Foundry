import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    './tests/**/*.{ts,tsx}',
    './stories/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#ffffff',
        'surface-muted': '#f8fafc',
        border: '#e2e8f0',
        foreground: '#0f172a',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.08)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
