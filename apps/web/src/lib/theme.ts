import { accentCssVars } from '@takeone/design-tokens';

const block = (vars: Record<string, string>) => Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
/**
 * White-label: an agency's brand colour replaces ONLY the accent tokens. Hover, soft, text and on-accent variants are
 * generated for both themes (and contrast-checked in packages/design-tokens).
 */
export function agencyThemeCss(primaryColor: string): string {
  return `:root,[data-theme='dark']{${block(accentCssVars(primaryColor, 'dark'))}}[data-theme='light']{${block(accentCssVars(primaryColor, 'light'))}}`;
}
/** Light mode is a brand-dashboard option only; every other surface stays dark. Runs before paint. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('t1-theme');document.documentElement.dataset.theme=(t==='light'&&/^\\/brand(\\/|$)/.test(location.pathname))?'light':'dark'}catch(e){}`;
