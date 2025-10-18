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
        surface: 'var(--sys-surface-canvas, #f8fafc)',
        'surface-raised': 'var(--sys-surface-raised, #ffffff)',
        'info-surface': 'var(--sys-status-info-surface, #e0f2ff)',
        'info-border': 'var(--sys-status-info-border, #38bdf8)',
        'info-text': 'var(--sys-status-info-text, #0369a1)',
        'info-icon': 'var(--sys-status-info-icon, #0284c7)',
        text: 'var(--sys-text-primary, #0f172a)',
        'text-muted': 'var(--sys-text-muted, #64748b)',
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
