import { TIERS, type Tier } from './config';

export const LEDGER_STATES = ['pending', 'cleared', 'available', 'withdrawn'] as const;
export type LedgerState = (typeof LEDGER_STATES)[number];

const NEXT: Record<LedgerState, LedgerState | null> = {
  pending: 'cleared',
  cleared: 'available',
  available: 'withdrawn',
  withdrawn: null,
};

export function canTransition(from: LedgerState, to: LedgerState): boolean {
  return NEXT[from] === to;
}

export interface LedgerFacts {
  /** brand payment settled */
  paymentSettled: boolean;
  /** brand approved (or auto-approved) the creator's submission */
  submissionApproved: boolean;
  availableAt: Date | null;
  now: Date;
}

/** pending → cleared needs BOTH settled payment and approved submission; cleared → available needs the tier delay to pass. */
export function nextLedgerState(state: LedgerState, f: LedgerFacts): LedgerState {
  if (state === 'pending' && f.paymentSettled && f.submissionApproved) return 'cleared';
  if (state === 'cleared' && f.availableAt && f.availableAt.getTime() <= f.now.getTime()) return 'available';
  return state;
}

export function effectiveTier(c: { tier: Tier; is_founding?: boolean | null }): Tier {
  return c.is_founding ? 'pro' : c.tier;
}

export function availableAt(clearedAt: Date, tier: Tier): Date {
  return new Date(clearedAt.getTime() + TIERS[tier].payoutDelayDays * 86_400_000);
}

export interface Balances {
  pending: number;
  cleared: number;
  available: number;
  withdrawn: number;
}
export function sumBalances(entries: { state: LedgerState; amount_minor: number }[]): Balances {
  const b: Balances = { pending: 0, cleared: 0, available: 0, withdrawn: 0 };
  for (const e of entries) b[e.state] += e.amount_minor;
  return b;
}

/** Withdrawals only from available balance. Returns an error string or null. */
export function validateWithdrawal(amountMinor: number, availableMinor: number): string | null {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return 'Enter a valid amount';
  if (amountMinor > availableMinor) return 'Amount exceeds your available balance';
  return null;
}
