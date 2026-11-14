import { Globe } from 'lucide-react';
import { COUNTRIES } from '@takeone/shared';

/* tokens-allow-file: national flag colours are fixed artwork, not UI colours */
const ART: Record<string, React.ReactNode> = {
  IN: (<><rect width="24" height="8" fill="#FF9933" /><rect y="8" width="24" height="8" fill="#FFFFFF" /><rect y="16" width="24" height="8" fill="#138808" /><circle cx="12" cy="12" r="2.6" fill="none" stroke="#000080" strokeWidth="0.9" /></>),
  AE: (<><rect width="24" height="8" fill="#00732F" /><rect y="8" width="24" height="8" fill="#FFFFFF" /><rect y="16" width="24" height="8" fill="#000000" /><rect width="7" height="24" fill="#FF0000" /></>),
};
/** Small circular flag. Replaces flag emoji everywhere in the web UI. */
export function Flag({ code, size = 16 }: { code: string; size?: 16 | 20 | 24 }) {
  const name = COUNTRIES[code as keyof typeof COUNTRIES]?.name ?? code;
  if (!ART[code]) return <Globe size={size} strokeWidth={1.5} className="shrink-0 text-tertiary" role="img" aria-label={name} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={name} className="shrink-0 rounded-full border border-border">
      <clipPath id={`flag-${code}`}><circle cx="12" cy="12" r="12" /></clipPath>
      <g clipPath={`url(#flag-${code})`}>{ART[code]}</g>
    </svg>
  );
}
