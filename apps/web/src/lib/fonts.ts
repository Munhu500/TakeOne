import localFont from 'next/font/local';

// Self-hosted (SIL OFL). No external font requests; size-adjusted fallbacks avoid layout shift.
export const geist = localFont({ src: '../fonts/Geist-Variable.woff2', variable: '--font-geist', weight: '100 900', display: 'swap', fallback: ['Inter', 'system-ui', 'sans-serif'] });
export const geistMono = localFont({ src: '../fonts/GeistMono-Variable.woff2', variable: '--font-geist-mono', weight: '100 900', display: 'swap', preload: false, fallback: ['ui-monospace', 'Menlo', 'monospace'] });
/** Landing-page headlines only: one or two emphasised words. Never in dashboards. */
export const instrumentSerif = localFont({ src: '../fonts/InstrumentSerif-Italic.woff2', variable: '--font-instrument-serif', weight: '400', style: 'italic', display: 'swap', preload: true, fallback: ['Georgia', 'serif'] });
export const fontVariables = `${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`;
