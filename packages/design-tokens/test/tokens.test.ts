import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, color, contrast, deriveAccent, INK, over, space, type } from '../src';

const AA = 4.5, AA_UI = 3;
const surfaces = ['bg', 'surface-1', 'surface-2', 'surface-3'] as const;

describe.each(['dark', 'light'] as const)('WCAG AA contrast — %s theme', (name) => {
  const c = color[name];
  it.each(['text-primary', 'text-secondary', 'text-tertiary', 'accent-text', 'success-text', 'warning-text', 'danger-text'] as const)('%s on every surface', (text) => {
    for (const s of surfaces) expect(contrast(c[text], c[s]), `${text} on ${s}`).toBeGreaterThanOrEqual(AA);
  });
  it.each([['accent-text', 'accent'], ['success-text', 'success'], ['warning-text', 'warning'], ['danger-text', 'danger']] as const)('%s on its soft badge background', (text, base) => {
    for (const s of ['surface-1', 'surface-3'] as const) expect(contrast(c[text], over(c[base], 0.12, c[s])), `${text} on ${base}-soft over ${s}`).toBeGreaterThanOrEqual(AA);
  });
  it('button labels', () => {
    expect(contrast(c['on-inverse'], c.inverse)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c['on-inverse'], c['inverse-hover'])).toBeGreaterThanOrEqual(AA);
    expect(contrast(c['on-accent'], c.accent)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c['on-accent'], c['accent-fill-hover'])).toBeGreaterThanOrEqual(AA);
  });
  it('accent indicators and focus rings are visible (3:1) on every surface', () => {
    for (const s of surfaces) expect(contrast(c.accent, c[s]), `accent on ${s}`).toBeGreaterThanOrEqual(AA_UI);
  });
  it('text over media scrim', () => {
    expect(contrast(c['on-media'], over('#000000', 0.72, '#FFFFFF'))).toBeGreaterThanOrEqual(AA);
  });
});

describe('agency accent', () => {
  it.each(['#E0A526', '#0EA5E9', '#111827', '#F43F5E', '#FDE047', '#1D4ED8'])('%s gets legible generated variants in both themes', (brand) => {
    for (const name of ['dark', 'light'] as const) {
      const a = deriveAccent(brand, name);
      expect(contrast(a['on-accent'], a.accent)).toBeGreaterThanOrEqual(AA);
      expect(contrast(a['on-accent'], a['accent-fill-hover'])).toBeGreaterThanOrEqual(AA);
      for (const s of surfaces) expect(contrast(a['accent-text'], color[name][s]), `${brand} text on ${name} ${s}`).toBeGreaterThanOrEqual(AA);
      expect(a['accent-soft']).toMatch(/^rgba\(\d+,\d+,\d+,0\.12\)$/);
    }
  });
  it('only accent tokens are replaced', () => {
    expect(Object.keys(deriveAccent('#E0A526')).sort()).toEqual(['accent', 'accent-fill-hover', 'accent-hover', 'accent-soft', 'accent-text', 'on-accent']);
  });
  it('default accent keeps the specified values', () => {
    expect(color.dark.accent).toBe('#7C5CFF');
    expect(color.dark['accent-hover']).toBe('#6A4BF0');
    expect(color.dark['on-accent']).toBe(INK);
  });
});

describe('scales', () => {
  it('spacing is the 4pt scale', () => {
    expect(Object.values(space)).toEqual([0, 4, 8, 12, 16, 20, 24, 32, 48, 64, 96, 128]);
  });
  it('type scale matches the spec', () => {
    expect(type.display.desktop).toEqual([76, 80]);
    expect(type.h1.mobile).toEqual([34, 38]);
    expect(type['stat-sm'].desktop).toEqual([32, 36]);
  });
  it('tokens.css is in sync with tokens.ts', () => {
    expect(readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')).toBe(buildCss());
  });
});
