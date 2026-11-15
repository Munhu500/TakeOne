import manifest from '@/lib/media-manifest.json';
import { productShortName } from '@takeone/shared';
import { cn, slugify } from '@/lib/utils';

const have = new Set(manifest as string[]);
/** Still images, smallest format first: an .avif or .webp beside a .jpg is always preferred. */
export const IMAGE_EXTS = ['avif', 'webp', 'jpg', 'jpeg', 'png'];
const RATIO = { reel: 'aspect-reel', portrait: 'aspect-portrait', square: 'aspect-square', video: 'aspect-video' };
const RADIUS = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl' };
export type Ratio = keyof typeof RATIO;

/** A file under /public/brand (the logo mark), or null. */
export function brandFile(name: string, exts: string[]): string | null {
  for (const e of exts) if (have.has(`/brand/${name}.${e}`)) return `/brand/${name}.${e}`;
  return null;
}
/** Supplied media under /public/media, or null. `name` is tried with each extension. */
export function mediaFile(path: string, exts: string[]): string | null {
  for (const e of exts) if (have.has(`/media/${path}.${e}`)) return `/media/${path}.${e}`;
  return null;
}

/**
 * Product photo. Uses, in order: an absolute image URL the brand supplied, /public/media/products/<slug>.jpg,
 * otherwise a neutral tile with the product's initial. Never an illustration.
 */
export function ProductImage({ name, shortName, src, ratio = 'portrait', radius = 'md', className }: { name: string; /** two or three characters set on the campaign, e.g. "SPF" */ shortName?: string | null; src?: string | null; ratio?: Ratio; radius?: keyof typeof RADIUS; className?: string }) {
  const url = (src && /^https?:\/\//.test(src) ? src : null) ?? mediaFile(`products/${slugify(name)}`, IMAGE_EXTS);
  const frame = cn('relative block shrink-0 overflow-hidden border border-border bg-surface-2', RATIO[ratio], RADIUS[radius], className);
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <span className={frame}><img src={url} alt={name} loading="lazy" className="absolute inset-0 size-full object-cover" /></span>;
  return <span role="img" aria-label={name} className={frame}><span aria-hidden className="frame-fit absolute inset-0 grid place-items-center"><span className="frame-initials font-semibold text-tertiary">{productShortName(name, shortName)}</span></span></span>;
}

/**
 * Video slot. Plays `src` (a signed URL or a /media path) when there is footage; otherwise a dark frame with a
 * subtle shimmer and "Footage coming soon". `media` names a file under /public/media to use when no src is given.
 */
export function VideoFrame({ src, poster, media, ratio = 'reel', radius = 'md', label, controls = true, autoPlay, priority, compact, placeholder, name, className }: {
  src?: string | null; poster?: string | null; media?: string; ratio?: Ratio; radius?: keyof typeof RADIUS; label: string; controls?: boolean; autoPlay?: boolean; /** above the fold: the poster is fetched first and the video waits for it */ priority?: boolean; /** thumbnail: never the long caption */ compact?: boolean; /** 'name' shows the frame's name instead of "Footage coming soon" at any size */ placeholder?: 'name'; /** short name for the placeholder, e.g. the format */ name?: string; className?: string;
}) {
  const file = src ?? (media ? mediaFile(media, ['mp4', 'webm']) : null);
  const still = poster ?? (media ? mediaFile(media, IMAGE_EXTS) : null);
  const frame = cn('relative block overflow-hidden border border-border bg-bg', RATIO[ratio], RADIUS[radius], className);
  if (file) {
    return (
      <span className={frame}>
        <video className="absolute inset-0 size-full object-cover" src={file} poster={still ?? undefined} controls={controls} autoPlay={autoPlay} muted={autoPlay} loop={autoPlay} playsInline preload={autoPlay ? (still ? 'metadata' : 'auto') : 'none'} aria-label={label} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  if (still) return <span className={frame}><img src={still} alt={label} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" className="absolute inset-0 size-full object-cover" /></span>;
  // Large frames say "Footage coming soon"; frames under 200px wide (or `placeholder="name"`) show only their name.
  return (
    <span role="img" aria-label={`${label}: footage coming soon`} className={frame}>
      <span aria-hidden className="skeleton absolute inset-0 rounded-none opacity-40" />
      <span aria-hidden data-show={placeholder === 'name' || compact ? 'name' : undefined} className="frame-fit absolute inset-0 grid place-items-center p-2 text-center">
        <span className="frame-caption caption-label">Footage coming soon</span>
        <span className="frame-name text-caption text-tertiary">{name ?? label}</span>
      </span>
    </span>
  );
}

/**
 * Full-bleed image slot (fills its positioned parent). Shows /public/media/<media>.jpg when supplied; until then a
 * neutral surface with a small "Image coming soon" label.
 */
export function ImageSlot({ media, alt, className }: { media: string; alt: string; className?: string }) {
  const url = mediaFile(media, IMAGE_EXTS);
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt={alt} loading="lazy" decoding="async" className={cn('absolute inset-0 size-full object-cover', className)} />;
  return (
    <span role="img" aria-label={`${alt}: image coming soon`} className={cn('absolute inset-0 bg-surface-1', className)}>
      <span aria-hidden className="caption-label absolute bottom-4 right-5">Image coming soon</span>
    </span>
  );
}
