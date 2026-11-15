import { z } from 'zod';
import { CATEGORIES, COUNTRY_CODES, PLATFORMS, WITHDRAWAL_METHODS, type WithdrawalMethod } from './config';
import { FORMAT_IDS } from './formats';

export const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const currencyCode = z.enum(['USD', 'INR', 'AED']);
export const countryCode = z.enum(COUNTRY_CODES as [string, ...string[]]);
export const category = z.enum(CATEGORIES);
export const uuid = z.string().uuid();

export const briefSchema = z.object({
  description: z.string().max(2000).default(''),
  key_benefits: z.array(z.string().max(200)).max(8).default([]),
  goals: z.string().max(1000).default(''),
  key_messages: z.array(z.string().max(200)).max(8).default([]),
  must_say: z.array(z.string().max(200)).max(8).default([]),
  must_not_say: z.array(z.string().max(200)).max(8).default([]),
  target_audience: z.string().max(500).default(''),
  uses_ai_likeness: z.boolean().default(true),
});
export type Brief = z.infer<typeof briefSchema>;

export const shotListSchema = z.object({
  shots: z.array(z.object({ title: z.string().max(80), direction: z.string().max(400), seconds: z.number().int().min(1).max(120) })).min(1).max(10),
  talking_points: z.array(z.string().max(240)).max(10),
  framing_tips: z.array(z.string().max(200)).max(6).default([]),
});
export type ShotList = z.infer<typeof shotListSchema>;

export const extractedProductSchema = z.object({
  product_name: z.string().max(160),
  description: z.string().max(2000),
  key_benefits: z.array(z.string().max(200)).max(8),
  images: z.array(z.string().url()).max(8),
});
export type ExtractedProduct = z.infer<typeof extractedProductSchema>;

export const campaignInputSchema = z.object({
  brand_id: uuid,
  title: z.string().min(3).max(120),
  product_name: z.string().min(1).max(160),
  product_url: z.string().url().or(z.literal('')).default(''),
  product_images: z.array(z.string()).max(8).default([]),
  brief: briefSchema,
  shot_list: shotListSchema,
  categories: z.array(category).min(1).max(4),
  countries: z.array(countryCode).min(1),
  creators_needed: z.number().int().min(1).max(100),
  fee_per_creator_minor: minor.min(100),
  deadline: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date'),
});
export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const applySchema = z.object({ campaign_id: uuid, pitch: z.string().max(400).optional() });

export const onboardingSchema = z
  .object({
    display_name: z.string().min(2).max(60),
    country: countryCode,
    categories: z.array(category).min(1).max(5),
    uae_permit_number: z.string().max(40).optional().nullable(),
    accepted_terms: z.literal(true),
  })
  .refine((v) => v.country !== 'AE' || !!v.uae_permit_number?.trim(), {
    path: ['uae_permit_number'],
    message: 'UAE Media Council Advertiser Permit number is required',
  });

export const socialAccountSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(2).max(40).regex(/^@?[A-Za-z0-9._]+$/, 'Letters, numbers, dots and underscores only'),
  followers: z.number().int().min(0).max(1_000_000_000),
  avg_views: z.number().int().min(0).max(1_000_000_000),
  engagement_rate: z.number().min(0).max(100),
});

export const messageSchema = z.object({ campaign_id: uuid, creator_id: uuid, body: z.string().min(1).max(2000) });

export const withdrawalSchema = z
  .object({
    method: z.enum(Object.keys(WITHDRAWAL_METHODS) as [WithdrawalMethod, ...WithdrawalMethod[]]),
    amount_minor: minor.min(1),
    destination: z.record(z.string().max(120)),
  })
  .superRefine((v, ctx) => {
    for (const f of WITHDRAWAL_METHODS[v.method].fields) {
      if (!v.destination[f]?.trim()) ctx.addIssue({ code: 'custom', path: ['destination', f], message: 'Required' });
    }
  });

export const kycSchema = z.object({ id_photo_path: z.string().min(1), selfie_path: z.string().min(1), tax_id: z.string().max(40).optional().nullable() });

export const licenseRequestSchema = z.object({
  variant_id: uuid,
  type: z.enum(['base', 'extra', 'renewal', 'buyout', 'whitelist']),
});

export const submitVariantsSchema = z.object({ assignment_id: uuid, variant_ids: z.array(uuid).min(1).max(10) });
export const formatId = z.enum(FORMAT_IDS);

export const agencyBrandingSchema = z.object({
  name: z.string().min(2).max(80),
  logo: z.string().max(500).nullable().optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  subdomain: z.string().min(2).max(120).regex(/^[a-z0-9.-]+$/),
  markup_default_bps: z.number().int().min(0).max(20_000),
});

/** TakeOne Live waitlist (landing page). */
export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(['creator', 'brand']),
  country: z.enum(['IN', 'AE']),
});
export type WaitlistInput = z.infer<typeof waitlistSchema>;
