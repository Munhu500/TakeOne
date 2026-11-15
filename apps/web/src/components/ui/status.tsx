import { VERIFICATION_BADGES } from '@takeone/shared';
import { cn, sentenceCase } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
const TONE: Record<Tone, string> = { neutral: 'bg-surface-3 text-secondary', accent: 'bg-accent-soft text-accent-text', success: 'bg-success-soft text-success-text', warning: 'bg-warning-soft text-warning-text', danger: 'bg-danger-soft text-danger-text' };

/** The shared status vocabulary. One label and one tone per status, used everywhere a status is shown. */
const VOCAB = {
  campaign: {
    draft: ['Draft', 'neutral'], pending_payment: ['Awaiting payment', 'warning'], live: ['Live', 'success'], in_review: ['In review', 'accent'],
    in_progress: ['In progress', 'accent'], completed: ['Completed', 'neutral'], cancelled: ['Cancelled', 'danger'],
  },
  payment: { pending: ['Awaiting payment', 'warning'], held: ['In escrow', 'warning'], released: ['Released', 'success'], refunded: ['Refunded', 'neutral'], failed: ['Failed', 'danger'] },
  verification: { self_reported: [VERIFICATION_BADGES.self_reported, 'neutral'], checked: [VERIFICATION_BADGES.checked, 'success'], api_verified: [VERIFICATION_BADGES.api_verified, 'accent'] },
  application: { applied: ['Applied', 'neutral'], shortlisted: ['Shortlisted', 'accent'], accepted: ['Accepted', 'success'], rejected: ['Declined', 'neutral'], invited: ['Invited', 'warning'], declined: ['Invite declined', 'neutral'], withdrawn: ['Withdrawn', 'neutral'] },
  assignment: {
    accepted: ['Shooting', 'neutral'], processing: ['Building variants', 'accent'], variants_ready: ['With creator', 'neutral'], qa_review: ['In review', 'accent'],
    delivered: ['Ready to review', 'accent'], approved: ['Approved', 'success'], completed: ['Completed', 'neutral'], disputed: ['In dispute', 'danger'],
  },
  variant: { coming_soon: ['Planned', 'neutral'], processing: ['Rendering', 'accent'], ready: ['Ready', 'neutral'], qa_pending: ['In review', 'accent'], qa_rejected: ['Needs changes', 'danger'], delivered: ['Preview', 'neutral'], selected: ['Licensed', 'success'], licensed: ['Licensed', 'success'], failed: ['Failed', 'danger'] },
  dispute: { open: ['Open', 'warning'], resolved_creator: ['Resolved for creator', 'success'], resolved_brand: ['Resolved for brand', 'neutral'], refunded: ['Refunded', 'neutral'] },
  withdrawal: { requested: ['Requested', 'warning'], processing: ['Processing', 'accent'], paid: ['Paid', 'success'], failed: ['Failed', 'danger'] },
  client: { active: ['Active', 'success'], idle: ['No live campaigns', 'neutral'], new: ['New', 'neutral'] },
  kyc: { none: ['Not started', 'neutral'], pending: ['In review', 'accent'], verified: ['Verified', 'success'], rejected: ['Rejected', 'danger'] },
} satisfies Record<string, Record<string, [string, Tone]>>;
export type StatusKind = keyof typeof VOCAB;

function lookup(kind: StatusKind, status: string): [string, Tone] {
  return (VOCAB[kind] as Record<string, [string, Tone]>)[status] ?? [sentenceCase(status), 'neutral'];
}
export const statusLabel = (kind: StatusKind, status: string) => lookup(kind, status)[0];
export function StatusBadge({ kind, status, className }: { kind: StatusKind; status: string; className?: string }) {
  const [label, tone] = lookup(kind, status);
  return <span className={cn('inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-caption', TONE[tone], className)}>{label}</span>;
}
