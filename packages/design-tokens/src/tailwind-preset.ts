import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import { color, font, layout, motion, radius, size, space, type, z } from './tokens';

const px = (n: number) => `${n / 16}rem`;
const v = (name: string) => `var(--${name})`;
const colorNames = Object.keys(color.dark).filter((k) => !k.startsWith('text-'));
const colors = { transparent: 'transparent', current: 'currentColor', ...Object.fromEntries(colorNames.map((k) => [k, v(k)])) };
const spacing = { px: '1px', ...Object.fromEntries(Object.entries(space).map(([k, n]) => [k, px(n)])) };
// Dimensions (width/height/inset…) keep Tailwind's sizing scale plus the token sizes; padding, margin and gap are token-only.
const dims = { ...defaultTheme.spacing, ...Object.fromEntries(Object.entries(size).filter(([, n]) => typeof n === 'number').map(([k, n]) => [k, px(n as number)])), sidebar: px(layout.sidebar), aside: px(layout.aside), panel: px(520) };
const withDims = (key: 'width' | 'height' | 'minHeight' | 'maxHeight' | 'size' | 'inset' | 'minWidth' | 'flexBasis' | 'translate') =>
  (defaultTheme[key] as unknown as (u: { theme: (k: string) => unknown; breakpoints: (b: unknown) => unknown }) => Record<string, string>)({ theme: () => dims, breakpoints: () => ({}) });

/** Every design token mapped to a Tailwind theme key. The palette, type scale, spacing, radii, shadows and z-index are replaced, not extended. */
const preset: Partial<Config> = {
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: Object.fromEntries(Object.entries(layout.breakpoint).map(([k, n]) => [k, `${n}px`])),
    colors,
    textColor: { ...colors, primary: v('text-primary'), secondary: v('text-secondary'), tertiary: v('text-tertiary') },
    spacing,
    width: withDims('width'), height: withDims('height'), minHeight: withDims('minHeight'), maxHeight: withDims('maxHeight'), size: withDims('size'),
    inset: withDims('inset'), minWidth: { ...withDims('minWidth'), table: px(720), 'table-wide': px(960) }, flexBasis: withDims('flexBasis'), translate: withDims('translate'),
    maxWidth: { none: 'none', full: '100%', content: px(layout.content), prose: layout.prose, xs: px(320), sm: px(384), md: px(448), lg: px(512), xl: px(576), '2xl': px(672), '3xl': px(768), '5xl': px(1024), phone: px(300), shell: px(1440) },
    fontFamily: { sans: [v('font-sans')], mono: [v('font-mono')], serif: [v('font-serif')] },
    fontSize: Object.fromEntries(Object.entries(type).map(([k, t]) => [k, [v(`fs-${k}`), { lineHeight: v(`lh-${k}`), letterSpacing: t.tracking, fontWeight: String(t.weight) }]])) as NonNullable<Config['theme']>['fontSize'],
    fontWeight: { normal: String(font.weight.regular), medium: String(font.weight.medium), semibold: String(font.weight.semibold) },
    letterSpacing: { normal: '0', label: '0.12em', code: '0.3em' },
    borderRadius: { none: '0', ...Object.fromEntries(Object.entries(radius).map(([k, n]) => [k, `${n}px`])) },
    boxShadow: { none: 'none', float: v('shadow-float') },
    zIndex: Object.fromEntries(Object.entries(z).map(([k, n]) => [k, String(n)])),
    transitionDuration: { fast: `${motion.duration.fast}ms`, base: `${motion.duration.base}ms`, slow: `${motion.duration.slow}ms`, DEFAULT: `${motion.duration.fast}ms` },
    transitionTimingFunction: { standard: motion.easingCss, DEFAULT: motion.easingCss },
    scale: { 100: '1', press: v('press-scale') },
    backdropBlur: { glass: v('glass-blur') },
    blur: { locked: '24px' },
    aspectRatio: { auto: 'auto', square: '1 / 1', reel: '9 / 16', portrait: '4 / 5', video: '16 / 9' },
    extend: {
      gridTemplateColumns: { /* cards fill the row: as many columns as fit at 20rem or wider, at most three in the dashboards' content width */ cards: `repeat(auto-fit, minmax(${px(320)}, 1fr))`, 'main-aside': `minmax(0, 1fr) ${px(layout.aside)}`, 'aside-main': `${px(260)} minmax(0, 1fr)`, 'main-narrow': `minmax(0, 1fr) ${px(320)}`, 'auto-fill': 'auto minmax(0, 1fr)', 'fill-auto': 'minmax(0, 1fr) auto', 'shot-row': `${px(160)} minmax(0, 1fr) ${px(80)} auto` },
      keyframes: { shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } }, spin: { to: { transform: 'rotate(360deg)' } } },
      animation: { shimmer: 'shimmer 1.6s linear infinite', spin: 'spin 0.8s linear infinite' },
    },
  },
};
export default preset;
