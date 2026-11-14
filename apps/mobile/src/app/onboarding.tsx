import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CATEGORIES, COUNTRIES, onboardingSchema, TERMS_VERSION, type CountryCode } from '@takeone/shared';
import { Button, Card, Chip, Field, ProgressBar, Row, Screen, Text, toastError } from '@/components/ui';
import { useMe } from '@/lib/data';
import { rpc } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

export default function Onboarding() {
  const c = useColors();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(me?.profile.display_name ?? '');
  const [country, setCountry] = useState<CountryCode>('IN');
  const [cats, setCats] = useState<string[]>([]);
  const [permit, setPermit] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canNext = [name.trim().length >= 2, cats.length >= 1 && cats.length <= 5, (country !== 'AE' || permit.trim().length > 0) && terms][step];
  async function finish() {
    const parsed = onboardingSchema.safeParse({ display_name: name.trim(), country, categories: cats, uae_permit_number: permit.trim() || null, accepted_terms: terms });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check your details');
    setBusy(true); setError(null);
    try {
      await rpc('complete_onboarding', { p_display_name: parsed.data.display_name, p_country: country, p_categories: cats, p_permit: permit.trim() || null });
      await qc.invalidateQueries({ queryKey: ['me'] });
      router.replace('/socials?onboarding=1');
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  return (
    <Screen footer={<Row gap={10}>{step > 0 && <Button style={{ flex: 1 }} variant="secondary" title="Back" onPress={() => setStep(step - 1)} />}<Button style={{ flex: 2 }} title={step === 2 ? 'Create my profile' : 'Continue'} disabled={!canNext} loading={busy} onPress={() => (step === 2 ? finish() : setStep(step + 1))} /></Row>}>
      <View style={{ marginTop: 16 }}><ProgressBar value={(step + 1) / 3} /></View>
      {step === 0 && (
        <>
          <Text size="xl" weight="bold">Where are you based?</Text>
          <Text tone="muted">Your country sets your currency and the campaigns you see.</Text>
          <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" />
          <View style={{ gap: 10 }}>
            {(Object.keys(COUNTRIES) as CountryCode[]).map((code) => (
              <Pressable key={code} accessibilityRole="radio" accessibilityState={{ selected: country === code }} onPress={() => setCountry(code)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: country === code ? `${c.accent}22` : c.raised, borderWidth: 1, borderColor: country === code ? c.accent : c.line }}>
                <Text size="xl">{COUNTRIES[code].flag}</Text>
                <View style={{ flex: 1 }}><Text weight="semibold">{COUNTRIES[code].name}</Text><Text size="sm" tone="muted">Earnings shown in {COUNTRIES[code].currency}</Text></View>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {step === 1 && (
        <>
          <Text size="xl" weight="bold">What do you create?</Text>
          <Text tone="muted">Pick up to five. Your feed is matched to these.</Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>{CATEGORIES.map((k) => <Chip key={k} label={k} on={cats.includes(k)} onPress={() => setCats(cats.includes(k) ? cats.filter((x) => x !== k) : cats.length < 5 ? [...cats, k] : cats)} />)}</Row>
        </>
      )}
      {step === 2 && (
        <>
          <Text size="xl" weight="bold">Almost there</Text>
          {country === 'AE' && <Field label="UAE Media Council Advertiser Permit number" value={permit} onChangeText={setPermit} autoCapitalize="characters" hint="Required for paid brand work in the UAE." error={error && !permit.trim() ? error : null} />}
          <Card>
            <Text weight="semibold">Creator terms</Text>
            <View style={{ gap: 6, marginTop: 8 }}>
              {['You keep 75% of every campaign fee and license payment.', 'Brands use selected variants as ads from their own accounts. You post only the winning ad.', 'Keep all brand conversations and payments on TakeOne. Contact details shared in chat are hidden.', 'Your likeness and voice are only ever used with your consent, campaign by campaign.'].map((t) => <Text key={t} size="sm" tone="muted">• {t}</Text>)}
            </View>
          </Card>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: terms }} onPress={() => setTerms(!terms)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: terms ? c.accent : c.faint, backgroundColor: terms ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{terms && <Text size="sm" tone="accentFg" weight="bold">✓</Text>}</View>
            <Text size="sm" tone="muted" style={{ flex: 1 }}>I accept the creator terms, including the non-circumvention clause (v{TERMS_VERSION}).</Text>
          </Pressable>
          {error && <Text size="sm" tone="bad">{error}</Text>}
        </>
      )}
    </Screen>
  );
}
