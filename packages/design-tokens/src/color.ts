/** Colour maths used to derive accent variants and to test contrast. Plain functions: usable from React Native too. */
export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
export const mix = (a: string, b: string, t: number): string => {
  const [x, y] = [parseHex(a), parseHex(b)];
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
};
export const alpha = (hex: string, a: number) => `rgba(${parseHex(hex).join(',')},${a})`;

const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/** WCAG 2.x contrast ratio between two opaque colours. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** The opaque colour you see when `fg` at opacity `a` sits on `bg`. */
export const over = (fg: string, a: number, bg: string) => mix(bg, fg, a);
/** Moves `from` toward `to` until it reaches `min` contrast against every background. */
export function ensureContrast(from: string, to: string, backgrounds: string[], min = 4.5): string {
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const c = mix(from, to, t);
    if (backgrounds.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return to;
}
