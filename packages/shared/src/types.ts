import type { Category, SocialPlatform, Tier, WithdrawalMethod } from './config';
import type { Aspect, FormatId } from './formats';
import type { LedgerState } from './ledger';
import type { LicenseType } from './pricing';
import type { Brief, ShotList } from './schemas';

export type Role = 'creator' | 'brand_member' | 'agency_member' | 'admin';
export type Verification = 'self_reported' | 'checked' | 'api_verified';
export const VERIFICATION_BADGES: Record<Verification, string> = {
  api_verified: 'Verified via API',
  checked: 'Checked',
  self_reported: 'Self-reported',
};
export type CampaignStatus = 'draft' | 'pending_payment' | 'live' | 'in_progress' | 'completed' | 'cancelled';
export type ApplicationStatus = 'applied' | 'shortlisted' | 'accepted' | 'rejected' | 'invited' | 'declined' | 'withdrawn';
export type AssignmentStatus = 'accepted' | 'processing' | 'variants_ready' | 'qa_review' | 'delivered' | 'approved' | 'completed' | 'disputed';
export type VariantStatus = 'coming_soon' | 'processing' | 'ready' | 'qa_pending' | 'qa_rejected' | 'delivered' | 'selected' | 'licensed' | 'failed';
export type JobType = 'process_take' | 'product_check';
export type JobStatus = 'queued' | 'running' | 'done' | 'failed';
export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type PaymentStatus = 'pending' | 'held' | 'released' | 'refunded' | 'failed';

export interface Profile { id: string; role: Role; display_name: string; country: string; currency: string; locale: string; avatar: string | null; onboarded: boolean; created_at: string }
export interface Creator {
  profile_id: string; bio: string | null; categories: Category[]; tier: Tier; is_founding: boolean; uae_permit_number: string | null;
  rating_avg: number | null; rating_count: number; win_rate: number; campaigns_completed: number; kyc_status: KycStatus; tax_id: string | null;
  show_exact_earnings: boolean; masking_attempts: number; flagged: boolean; pro_free_until: string | null; created_at: string;
}
/** What brands and agencies are allowed to see (view creator_public). */
export interface CreatorPublic {
  profile_id: string; display_name: string; avatar: string | null; country: string; bio: string | null; categories: Category[]; is_pro: boolean;
  is_founding: boolean; rating_avg: number | null; rating_count: number; win_rate: number; campaigns_completed: number; joined_at: string; has_likeness: boolean;
}
export interface SocialAccount {
  id: string; creator_id: string; platform: SocialPlatform; handle: string; followers: number; avg_views: number; engagement_rate: number;
  verification: Verification; ownership_code: string | null; ownership_requested_at: string | null; ownership_verified_at: string | null;
  screen_recording_path: string | null; screen_recording_code: string | null; public_metrics: Record<string, number> | null;
  plausibility_score: number | null; flags: string[]; created_at: string;
}
export type SocialAccountPublic = Pick<SocialAccount, 'id' | 'creator_id' | 'platform' | 'handle' | 'followers' | 'avg_views' | 'engagement_rate' | 'verification'>;
export interface LikenessProfile { creator_id: string; status: 'none' | 'capturing' | 'ready' | 'revoked'; voice_provider_id: string | null; capture_paths: string[]; consent_version: string; created_at: string; revoked_at: string | null }
export interface Brand { id: string; name: string; logo: string | null; country: string; currency: string; agency_id: string | null; credit_balance: number; markup_bps: number | null; created_at: string }
export interface Agency { id: string; name: string; logo: string | null; primary_color: string; subdomain: string; markup_default_bps: number; created_at: string }
export interface Campaign {
  id: string; brand_id: string; agency_id: string | null; title: string; product_name: string; product_url: string | null; product_images: string[];
  brief: Brief; shot_list: ShotList; categories: Category[]; countries: string[]; creators_needed: number; fee_per_creator_minor: number; currency: string;
  deadline: string; status: CampaignStatus; early_access_until: string | null; qa_required: boolean; published_at: string | null; completed_at: string | null; created_at: string;
}
export interface Application { id: string; campaign_id: string; creator_id: string; pitch: string | null; status: ApplicationStatus; invited: boolean; invited_at: string | null; responded_at: string | null; created_at: string }
export interface Assignment {
  id: string; campaign_id: string; creator_id: string; status: AssignmentStatus; product_shipped_at: string | null; due_at: string | null; submitted_at: string | null;
  delivered_at: string | null; approved_at: string | null; auto_approved: boolean; winning_variant_id: string | null; post_url: string | null; posted_at: string | null; created_at: string;
}
export interface TranscriptWord { w: string; s: number; e: number; filler?: boolean }
export interface Transcript { text: string; language: string; words: TranscriptWord[]; segments: { text: string; s: number; e: number }[] }
export interface Take { id: string; assignment_id: string; storage_path: string; duration: number | null; product_check: 'pending' | 'passed' | 'failed'; product_check_reason: string | null; transcript: Transcript | null; dub_language: string | null; created_at: string }
export interface Job { id: string; type: JobType; payload: Record<string, unknown>; status: JobStatus; attempts: number; error: string | null; progress: number; created_at: string }
export interface Variant {
  id: string; take_id: string; format: FormatId; aspect: Aspect; storage_path: string | null; renditions: Partial<Record<Aspect, string>>; preview_renditions: Partial<Record<Aspect, string>>;
  thumbnail: string | null; hook_text: string | null; hook_options: string[]; score: number | null; score_reason: string | null; is_synthetic: boolean; ai_disclosure: string | null;
  language: string | null; visible_to_brand: boolean; status: VariantStatus; qa_note: string | null; created_at: string;
}
export interface License { id: string; variant_id: string; brand_id: string; campaign_id: string; type: LicenseType; starts_at: string; ends_at: string | null; price_minor: number; currency: string; payment_id: string | null; reminder_sent_at: string | null; created_at: string }
export interface Payment { id: string; brand_id: string; campaign_id: string | null; kind: 'campaign' | 'license'; provider: string; provider_ref: string | null; amount_minor: number; gross_minor: number; currency: string; status: PaymentStatus; credit_applied_minor: number; created_at: string }
export interface LedgerEntry {
  id: string; creator_id: string; source: 'campaign' | 'license'; amount_minor: number; currency: string; state: LedgerState; available_at: string | null; cleared_at: string | null;
  campaign_id: string | null; assignment_id: string | null; license_id: string | null; payment_id: string | null; withdrawal_id: string | null; description: string | null; created_at: string;
}
export interface Withdrawal { id: string; creator_id: string; method: WithdrawalMethod; destination: Record<string, string>; amount_minor: number; currency: string; status: 'requested' | 'processing' | 'paid' | 'failed'; provider_ref: string | null; created_at: string }
export interface Credit { id: string; brand_id: string; amount_minor: number; currency: string; expires_at: string; source_campaign_id: string | null; used_minor: number; created_at: string }
export interface Message { id: string; campaign_id: string; creator_id: string; sender_id: string; body_masked: string; had_masking: boolean; created_at: string }
export interface FxRate { currency: string; rate_to_usd: number; updated_at: string }
