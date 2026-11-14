import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), raised: v('raised'), line: v('line'),
        fg: v('fg'), muted: v('muted'), faint: v('faint'),
        accent: v('accent'), 'accent-fg': v('accent-fg'),
        ok: v('ok'), warn: v('warn'), bad: v('bad'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Clash Display"', 'Satoshi', '"Inter Display"', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: { xl: '14px', '2xl': '20px' },
    },
  },
  plugins: [],
} satisfies Config;
