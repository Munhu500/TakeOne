import { Avatar } from '@/components/ui';
import { brandFile } from '@/components/ui/media';
import { cn } from '@/lib/utils';

/**
 * Mark + wordmark, used in the sidebar, navigation and footer.
 * - TakeOne: the mark is /public/brand/logo-mark.svg when that file exists; until then the wordmark stands alone.
 * - Agencies (white-label): pass their `logo`; with none, an initials tile is shown so the collapsed sidebar still has a mark.
 */
export function Logo({ name = 'TakeOne', logo, agency, wordmark = true, className }: { name?: string; logo?: string | null; /** an agency's brand, not TakeOne's */ agency?: boolean; wordmark?: boolean; className?: string }) {
  const mark = agency ? logo : brandFile('logo-mark', ['svg']);
  const tile = agency ? <Avatar name={name} src={mark} size="sm" square /> : mark
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={mark} alt="" width={28} height={28} className="size-7 shrink-0" /> : null;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-3 text-body-lg font-semibold', className)}>
      {tile}
      {wordmark ? <span className="truncate">{name}</span> : !tile ? <Avatar name={name} size="sm" square /> : <span className="sr-only">{name}</span>}
    </span>
  );
}
