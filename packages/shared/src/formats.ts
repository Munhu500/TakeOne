export const ASPECTS = ['9:16', '4:5', '1:1'] as const;
export type Aspect = (typeof ASPECTS)[number];
export const ASPECT_SIZES: Record<Aspect, { w: number; h: number }> = {
  '9:16': { w: 720, h: 1280 },
  '4:5': { w: 720, h: 900 },
  '1:1': { w: 720, h: 720 },
};

export const FORMAT_IDS = [
  'hook_first',
  'unboxing_first_use',
  'before_after',
  'three_reasons',
  'testimonial_tight',
  'day_in_life',
  'reaction_first_impression',
  'comparison',
  'silent_montage',
  'language_version',
] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export interface FormatDefinition {
  id: FormatId;
  order: number;
  name: string;
  tagline: string;
  description: string;
  /** fully implemented in v1; others show as "coming soon" */
  v1: boolean;
  proOnly: boolean;
  /** uses scene replacement or voice dubbing → is_synthetic + AI disclosure */
  synthetic: boolean;
  usesSceneReplacement: boolean;
  usesDubbing: boolean;
  /** rules the hook writer and the ranker score against */
  rules: string[];
  edit: {
    hookOverlay: boolean;
    captions: 'none' | 'standard' | 'large';
    removeFiller: boolean;
    music: 'none' | 'bed' | 'lead';
    muteVoice: boolean;
    /** max output seconds */
    maxDuration: number;
    /** put the strongest segment first */
    leadWithStrongest: boolean;
    /** max seconds per cut for montage styles */
    maxCutSeconds?: number;
  };
}

const base = { proOnly: false, synthetic: false, usesSceneReplacement: false, usesDubbing: false };

export const FORMATS: Record<FormatId, FormatDefinition> = {
  hook_first: {
    ...base, id: 'hook_first', order: 1, v1: true,
    name: 'Hook First', tagline: 'Problem in the first 2 seconds',
    description: 'Opens on the strongest problem statement, then tight cuts with on-screen hook text.',
    rules: ['Strongest problem statement lands inside the first 2 seconds', 'On-screen hook text is 9 words or fewer', 'No cut longer than 4 seconds', 'Product visible within 5 seconds'],
    edit: { hookOverlay: true, captions: 'standard', removeFiller: true, music: 'bed', muteVoice: false, maxDuration: 30, leadWithStrongest: true, maxCutSeconds: 4 },
  },
  unboxing_first_use: {
    ...base, id: 'unboxing_first_use', order: 2, v1: false,
    name: 'Unboxing + First Use', tagline: 'Open it, try it, react',
    description: 'Package reveal followed by the first real use and honest reaction.',
    rules: ['Shows the unopened package', 'First use happens on camera', 'Reaction is unscripted'],
    edit: { hookOverlay: true, captions: 'standard', removeFiller: true, music: 'bed', muteVoice: false, maxDuration: 45, leadWithStrongest: false },
  },
  before_after: {
    ...base, id: 'before_after', order: 3, v1: false,
    name: 'Before / After', tagline: 'Real results only',
    description: 'Side-by-side or sequential real results. Results are never AI-generated or retouched.',
    rules: ['Both states are real footage from the creator', 'No AI generation, retouching or filters on results', 'Same lighting and angle where possible'],
    edit: { hookOverlay: true, captions: 'standard', removeFiller: true, music: 'bed', muteVoice: false, maxDuration: 30, leadWithStrongest: false },
  },
  three_reasons: {
    ...base, id: 'three_reasons', order: 4, v1: false,
    name: '3 Reasons', tagline: 'Numbered and punchy',
    description: 'Three numbered reasons the creator gave, each with its own on-screen title.',
    rules: ['Exactly three reasons, all from the creator’s own words', 'Each reason under 8 seconds', 'Numbered on-screen titles'],
    edit: { hookOverlay: true, captions: 'large', removeFiller: true, music: 'bed', muteVoice: false, maxDuration: 30, leadWithStrongest: false },
  },
  testimonial_tight: {
    ...base, id: 'testimonial_tight', order: 5, v1: true,
    name: 'Tight Testimonial', tagline: 'Talking head, zero filler',
    description: 'A clean talking-head testimonial with filler words and dead air removed, fully captioned.',
    rules: ['Filler words and silences removed', 'Creator’s verdict kept word for word', 'Captions on every spoken line', 'Original order of statements preserved'],
    edit: { hookOverlay: false, captions: 'standard', removeFiller: true, music: 'none', muteVoice: false, maxDuration: 45, leadWithStrongest: false },
  },
  day_in_life: {
    ...base, id: 'day_in_life', order: 6, v1: true, synthetic: true, usesSceneReplacement: true,
    name: 'Day in the Life', tagline: 'Same you, new scene',
    description: 'Creator and product stay untouched in the foreground while the background becomes an AI-generated lifestyle scene.',
    rules: ['Creator and product pixels are never altered', 'Scene matches the brief’s audience and setting', 'Carries an AI disclosure label'],
    edit: { hookOverlay: true, captions: 'standard', removeFiller: true, music: 'bed', muteVoice: false, maxDuration: 30, leadWithStrongest: false },
  },
  reaction_first_impression: {
    ...base, id: 'reaction_first_impression', order: 7, v1: false,
    name: 'First Impression', tagline: 'The honest first reaction',
    description: 'Leads with the creator’s genuine first reaction, then the why.',
    rules: ['Reaction is the first shot', 'No re-enacted reactions'],
    edit: { hookOverlay: true, captions: 'standard', removeFiller: true, music: 'bed', muteVoice: false, maxDuration: 30, leadWithStrongest: true },
  },
  comparison: {
    ...base, id: 'comparison', order: 8, v1: false,
    name: 'Comparison', tagline: 'This vs what I used before',
    description: 'The product against what the creator used before, in their own words.',
    rules: ['Only comparisons the creator actually made', 'No competitor brand names unless the brief allows'],
    edit: { hookOverlay: true, captions: 'standard', removeFiller: true, music: 'bed', muteVoice: false, maxDuration: 40, leadWithStrongest: false },
  },
  silent_montage: {
    ...base, id: 'silent_montage', order: 9, v1: true,
    name: 'Silent Montage', tagline: 'Built for sound-off',
    description: 'A fast captioned montage with a music bed, designed to work with the sound off.',
    rules: ['Understandable with the sound off', 'Large captions, 6 words or fewer per card', 'Cuts every 2 seconds or faster', 'Music bed, no voice'],
    edit: { hookOverlay: true, captions: 'large', removeFiller: true, music: 'lead', muteVoice: true, maxDuration: 20, leadWithStrongest: true, maxCutSeconds: 2 },
  },
  language_version: {
    ...base, id: 'language_version', order: 10, v1: true, proOnly: true, synthetic: true, usesDubbing: true,
    name: 'Language Version', tagline: 'Your review, another language',
    description: 'The creator’s real review dubbed into another language in their own cloned voice. Meaning is translated, never changed.',
    rules: ['Translation preserves the creator’s meaning and verdict exactly', 'Uses the creator’s consented voice clone only', 'Captions in the target language', 'Carries an AI disclosure label'],
    edit: { hookOverlay: false, captions: 'standard', removeFiller: true, music: 'none', muteVoice: true, maxDuration: 45, leadWithStrongest: false },
  },
};

export const FORMAT_LIST: FormatDefinition[] = FORMAT_IDS.map((id) => FORMATS[id]);
export const V1_FORMATS: FormatDefinition[] = FORMAT_LIST.filter((f) => f.v1);

export const AI_DISCLOSURE_NOTE = 'Enable the platform’s AI-info label when publishing';

/** Formats a creator's take will be built into, given their tier. */
export function formatsForTier(isPro: boolean): FormatDefinition[] {
  return V1_FORMATS.filter((f) => !f.proOnly || isPro);
}
