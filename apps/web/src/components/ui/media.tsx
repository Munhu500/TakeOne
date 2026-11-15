import manifest from '@/lib/media-manifest.json';
import { cn, initials, slugify } from '@/lib/utils';

const have = new Set(manifest as string[]);
const RATIO = { reel: 'aspect-reel', portrait: 'aspect-portrait', square: 'aspect-square', video: 'aspect-video' };
const RADIUS = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl' };
export type Ratio = keyof typeof RATIO;

/** Supplied media under /public/media, or null. `name` is tried with each extension. */
export function mediaFile(path: string, exts: string[]): string | null {
  for (const e of exts) if (have.has(`/media/${path}.${e}`)) return `/media/${path}.${e}`;
  return null;
}

/**
 * Product photo. Uses, in order: an absolute image URL the brand supplied, /public/media/products/<slug>.jpg,
 * otherwise a neutral tile with the product's initial. Never an illustration.
 */
export function ProductImage({ name, src, ratio = 'portrait', radius = 'md', className }: { name: string; src?: string | null; ratio?: Ratio; radius?: keyof typeof RADIUS; className?: string }) {
  const url = (src && /^https?:\/\//.test(src) ? src : null) ?? mediaFile(`products/${slugify(name)}`, ['jpg', 'jpeg', 'png', 'webp']);
  const frame = cn('relative block shrink-0 overflow-hidden border border-border bg-surface-2', RATIO[ratio], RADIUS[radius], className);
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <span className={frame}><img src={url} alt={name} loading="lazy" className="absolute inset-0 size-full object-cover" /></span>;
  return <span role="img" aria-label={name} className={cn(frame, 'grid place-items-center')}><span aria-hidden className="text-h3 text-tertiary">{initials(name).charAt(0)}</span></span>;
}

/**
 * Video slot. Plays `src` (a signed URL or a /media path) when there is footage; otherwise a dark frame with a
 * subtle shimmer and "Footage coming soon". `media` names a file under /public/media to use when no src is given.
 */
export function VideoFrame({ src, poster, media, ratio = 'reel', radius = 'md', label, controls = true, autoPlay, className }: {
  src?: string | null; poster?: string | null; media?: string; ratio?: Ratio; radius?: keyof typeof RADIUS; label: string; controls?: boolean; autoPlay?: boolean; className?: string;
}) {
  const file = src ?? (media ? mediaFile(media, ['mp4', 'webm']) : null);
  const still = poster ?? (media ? mediaFile(media, ['jpg', 'jpeg', 'png', 'webp']) : null);
  const frame = cn('relative block overflow-hidden border border-border bg-bg', RATIO[ratio], RADIUS[radius], className);
  if (file) {
    return (
      <span className={frame}>
        <video className="absolute inset-0 size-full object-cover" src={file} poster={still ?? undefined} controls={controls} autoPlay={autoPlay} muted={autoPlay} loop={autoPlay} playsInline preload={autoPlay ? 'auto' : 'none'} aria-label={label} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  if (still) return <span className={frame}><img src={still} alt={label} className="absolute inset-0 size-full object-cover" /></span>;
  return (
    <span role="img" aria-label={`${label}: footage coming soon`} className={cn(frame, 'grid place-items-center')}>
      <span aria-hidden className="skeleton absolute inset-0 rounded-none opacity-40" />
      <span className="caption-label relative">Footage coming soon</span>
    </span>
  );
}

/**
 * Full-bleed image slot (fills its positioned parent). Shows /public/media/<media>.jpg when supplied; until then a
 * neutral surface with a small "Image coming soon" label.
 */
export function ImageSlot({ media, alt, className }: { media: string; alt: string; className?: string }) {
  const url = mediaFile(media, ['jpg', 'jpeg', 'png', 'webp']);
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt={alt} loading="lazy" decoding="async" className={cn('absolute inset-0 size-full object-cover', className)} />;
  return (
    <span role="img" aria-label={`${alt}: image coming soon`} className={cn('absolute inset-0 bg-surface-1', className)}>
      <span aria-hidden className="caption-label absolute bottom-4 right-5">Image coming soon</span>
    </span>
  );
}
