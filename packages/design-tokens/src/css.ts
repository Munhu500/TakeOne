import { color, font, glassBlur, layout, motion, radius, shadow, type, z, deriveAccent, type ThemeName } from './tokens';

const vars = (o: Record<string, string | number>, indent = '  ') => Object.entries(o).map(([k, v]) => `${indent}--${k}: ${v};`).join('\n');
const typeVars = (which: 'desktop' | 'mobile') => Object.fromEntries(Object.entries(type).flatMap(([k, t]) => [[`fs-${k}`, `${t[which][0] / 16}rem`], [`lh-${k}`, `${t[which][1] / 16}rem`]]));

/** CSS custom properties an agency theme overrides (accent only). Used by the web layout for white-label. */
export function accentCssVars(accent: string, theme: ThemeName = 'dark'): Record<string, string> {
  return Object.fromEntries(Object.entries(deriveAccent(accent, theme)).map(([k, v]) => [`--${k}`, v]));
}

export function buildCss(): string {
  return `/* Generated from src/tokens.ts by \`pnpm --filter @takeone/design-tokens build\`. Do not edit by hand. */
:root, [data-theme='dark'] {
  color-scheme: dark;
${vars(color.dark)}
}
[data-theme='light'] {
  color-scheme: light;
${vars(color.light)}
}
:root {
${vars({ 'font-sans': `var(--font-geist, ${font.sans})`, 'font-mono': `var(--font-geist-mono, ${font.mono})`, 'font-serif': `var(--font-instrument-serif, ${font.serif})` })}
${vars(typeVars('mobile'))}
${vars(Object.fromEntries(Object.entries(radius).map(([k, v]) => [`radius-${k}`, `${v}px`])))}
${vars({ 'shadow-float': shadow.float, 'glass-blur': `${glassBlur}px`, 'content-max': `${layout.content}px`, gutter: `${layout.gutterMobile}px` })}
${vars(Object.fromEntries(Object.entries(z).map(([k, v]) => [`z-${k}`, v])))}
${vars({ 'duration-fast': `${motion.duration.fast}ms`, 'duration-base': `${motion.duration.base}ms`, 'duration-slow': `${motion.duration.slow}ms`, ease: motion.easingCss, 'press-scale': motion.pressScale })}
}
@media (min-width: ${layout.breakpoint.md}px) {
  :root {
${vars({ ...typeVars('desktop'), gutter: `${layout.gutter}px` }, '    ')}
  }
}
@media (prefers-reduced-motion: reduce) {
  :root { --press-scale: 1; }
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-property: opacity, color, background-color, border-color !important; }
}
`;
}
