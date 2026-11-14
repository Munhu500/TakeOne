/**
 * TakeOne design tokens — "Studio Noir". Single source of truth for web (CSS variables + Tailwind preset)
 * and, later, the Expo app (import this file directly; everything here is plain data).
 * tokens.css is generated from this file: `pnpm --filter @takeone/design-tokens build`.
 */
import { alpha, contrast, ensureContrast, mix, over } from './color';

export const INK = '#09090B';
export const PAPER = '#FAFAFA';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
export const DEFAULT_ACCENT = '#7C5CFF';

const SOFT = 0.12;
const surfacesDark = { bg: '#09090B', 'surface-1': '#111114', 'surface-2': '#18181C', 'surface-3': '#222228' };
const surfacesLight = { bg: '#FAFAF9', 'surface-1': '#FFFFFF', 'surface-2': '#F4F4F5', 'surface-3': '#E4E4E7' };
const status = { success: '#34D399', warning: '#FBBF24', danger: '#F87171' };

export type ThemeName = 'dark' | 'light';
export interface AccentTokens { accent: string; 'accent-hover': string; 'accent-soft': string; 'accent-text': string; 'on-accent': string; 'accent-fill-hover': string }

/**
 * An agency's brand colour replaces only these tokens. Hover/soft/text variants are generated, and the label colour
 * on an accent fill is whichever of ink/white reads better, so any brand colour stays legible.
 */
export function deriveAccent(accent: string, theme: ThemeName = 'dark'): AccentTokens {
  const s = theme === 'dark' ? surfacesDark : surfacesLight;
  const onAccent = contrast(INK, accent) >= contrast(WHITE, accent) ? INK : WHITE;
  // text-coloured accent (links, badges, key numbers) must reach AA on every surface, including its own soft tint
  const backgrounds = [...Object.values(s), over(accent, SOFT, s['surface-1']), over(accent, SOFT, s['surface-3'])];
  return {
    accent,
    'accent-hover': mix(accent, BLACK, 0.12),
    'accent-soft': alpha(accent, SOFT),
    'accent-text': ensureContrast(accent, theme === 'dark' ? WHITE : BLACK, backgrounds),
    'on-accent': onAccent,
    // the filled button moves toward its label's opposite on hover, so the label never loses contrast
    'accent-fill-hover': mix(accent, onAccent === INK ? WHITE : BLACK, 0.12),
  };
}

function theme(name: ThemeName) {
  const dark = name === 'dark';
  const s = dark ? surfacesDark : surfacesLight;
  const soft = (c: string) => [over(c, SOFT, s['surface-1']), over(c, SOFT, s['surface-3'])];
  const all = Object.values(s);
  const statusText = (c: string) => ensureContrast(c, dark ? WHITE : BLACK, [...all, ...soft(c)]);
  const a = deriveAccent(DEFAULT_ACCENT, name);
  return {
    ...s,
    border: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    'border-strong': dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)',
    'text-primary': dark ? PAPER : INK,
    'text-secondary': dark ? '#A1A1AA' : '#52525B',
    // spec value #71717A is below AA on raised surfaces; nudged the minimum amount that passes on every surface
    'text-tertiary': ensureContrast('#71717A', dark ? WHITE : BLACK, all),
    ...a,
    // spec: accent-hover #6A4BF0 for the default accent
    'accent-hover': '#6A4BF0',
    ...status,
    'success-soft': alpha(status.success, SOFT), 'warning-soft': alpha(status.warning, SOFT), 'danger-soft': alpha(status.danger, SOFT),
    'success-text': statusText(status.success), 'warning-text': statusText(status.warning), 'danger-text': statusText(status.danger),
    // primary button: white pill with black text in dark; inverts in light
    inverse: dark ? PAPER : INK, 'on-inverse': dark ? INK : PAPER, 'inverse-hover': dark ? '#E4E4E7' : '#27272A',
    // the only permitted gradient: black → transparent over imagery, for legibility
    scrim: 'rgba(0,0,0,0.72)', 'scrim-soft': 'rgba(0,0,0,0.4)', 'on-media': PAPER, 'on-media-muted': 'rgba(250,250,250,0.72)',
    glass: dark ? 'rgba(9,9,11,0.72)' : 'rgba(250,250,249,0.72)',
  };
}
export const color = { dark: theme('dark'), light: theme('light') };
export type ColorToken = keyof (typeof color)['dark'];

export const font = {
  sans: '"Geist", Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',
  serif: '"Instrument Serif", Georgia, serif',
  weight: { regular: 400, medium: 500, semibold: 600 },
} as const;

/** [font-size px, line-height px] for desktop and mobile web (below 768px). */
export const type = {
  display: { desktop: [76, 80], mobile: [44, 48], weight: 600, tracking: '-0.04em' },
  h1: { desktop: [52, 56], mobile: [34, 38], weight: 600, tracking: '-0.035em' },
  h2: { desktop: [36, 42], mobile: [26, 32], weight: 600, tracking: '-0.03em' },
  h3: { desktop: [22, 28], mobile: [20, 26], weight: 600, tracking: '-0.02em' },
  'body-lg': { desktop: [18, 30], mobile: [17, 26], weight: 400, tracking: '0' },
  body: { desktop: [16, 26], mobile: [15, 22], weight: 400, tracking: '0' },
  small: { desktop: [14, 20], mobile: [14, 20], weight: 400, tracking: '0' },
  caption: { desktop: [12, 16], mobile: [12, 16], weight: 500, tracking: '0' },
  stat: { desktop: [56, 56], mobile: [40, 40], weight: 600, tracking: '-0.04em' },
  'stat-sm': { desktop: [32, 36], mobile: [32, 36], weight: 600, tracking: '-0.03em' },
} as const;
export type TypeToken = keyof typeof type;
/** The uppercase label style ("caption") on top of the caption size. */
export const captionLabel = { tracking: '0.12em', transform: 'uppercase' } as const;

/** 4pt spacing scale, keyed like Tailwind (key × 4 = px). 20 is the mobile gutter / mobile card padding. */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 12: 48, 16: 64, 24: 96, 32: 128 } as const;
export const radius = { sm: 10, md: 16, lg: 24, xl: 32, full: 999 } as const;
export const layout = { content: 1200, gutter: 24, gutterMobile: 20, columns: 12, sidebar: 240, aside: 340, prose: '65ch', breakpoint: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1440 } } as const;
/** Fixed control and row heights. */
export const size = { 'control-sm': 36, 'control-md': 44, 'control-lg': 52, input: 48, row: 56, 'row-media': 72, icon: { sm: 16, md: 20, lg: 24 } } as const;
export const iconStroke = 1.5;
/** Cards have no shadow. Only floating layers (menus, popovers, modals, toasts, drawers) use this. */
export const shadow = { float: '0 24px 64px -16px rgba(0,0,0,0.7)' } as const;
export const glassBlur = 20;
export const z = { base: 0, sticky: 10, nav: 20, dropdown: 30, drawer: 40, modal: 50, toast: 60 } as const;

export const motion = {
  duration: { fast: 150, base: 250, slow: 400 },
  easing: [0.22, 1, 0.36, 1] as [number, number, number, number],
  easingCss: 'cubic-bezier(0.22, 1, 0.36, 1)',
  pressScale: 0.98,
  revealRise: 16,
  stagger: 60,
} as const;

/** Framer Motion presets (plain objects; also usable with Reanimated/Moti later). */
const t = (ms: number) => ({ duration: ms / 1000, ease: motion.easing });
export const motionPresets = {
  /** Section reveal: fade + 16px rise, children staggered by 60ms, once only. */
  revealContainer: { hidden: {}, show: { transition: { staggerChildren: motion.stagger / 1000 } } },
  revealItem: { hidden: { opacity: 0, y: motion.revealRise }, show: { opacity: 1, y: 0, transition: t(motion.duration.slow) } },
  /** Reduced motion: opacity only. */
  revealItemReduced: { hidden: { opacity: 0 }, show: { opacity: 1, transition: t(motion.duration.slow) } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: t(motion.duration.base) },
  overlay: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: t(motion.duration.base) },
  dialog: { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8 }, transition: t(motion.duration.base) },
  drawer: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' }, transition: t(motion.duration.slow) },
  toast: { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 }, transition: t(motion.duration.base) },
  press: { whileTap: { scale: motion.pressScale }, transition: t(motion.duration.fast) },
  viewport: { once: true, margin: '-80px' },
} as const;

export const tokens = { color, font, type, captionLabel, space, radius, layout, size, iconStroke, shadow, glassBlur, z, motion } as const;
