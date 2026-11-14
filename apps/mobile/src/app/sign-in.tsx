import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Field, Row, Screen, Text } from '@/components/ui';
import { DEMO, supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

const DEMO_LOGINS = [['Priya · Pro creator, India', 'creator@takeone.demo'], ['Rohan · Free creator, India', 'creator.free@takeone.demo'], ['Arjun · creator, UAE', 'creator.ae@takeone.demo']] as const;
const DEMO_PASSWORD = 'TakeOne-demo-2026';

export default function SignIn() {
  const c = useColors();
  const [mode, setMode] = useState<'code' | 'password'>('code');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<{ error: { message: string } | null }>, after?: () => void) {
    setBusy(true); setError(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(error.message); else if (after) after(); else router.replace('/');
  }
  const submit = () => {
    if (mode === 'password') return run(() => supabase.auth.signInWithPassword({ email: email.trim(), password: secret }));
    // email one-time code: new creators are created on first sign-in (role defaults to creator)
    if (!sent) return run(() => supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, data: { role: 'creator' } } }), () => setSent(true));
    return run(() => supabase.auth.verifyOtp({ email: email.trim(), token: secret.trim(), type: 'email' }));
  };
  const oauth = (provider: 'google' | 'apple') => run(() => supabase.auth.signInWithOAuth({ provider, options: { redirectTo: Linking.createURL('/') } }), () => {});

  return (
    <Screen>
      <View style={{ marginTop: 36, gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}><Text weight="bold" size="lg" tone="accentFg">T</Text></View>
        <Text size="xxl" weight="bold">One take.{'\n'}<Text size="xxl" weight="bold" tone="accent">Ten ads.</Text></Text>
        <Text tone="muted">Find paid campaigns, shoot once with the real product, and keep 75% of everything your take earns.</Text>
      </View>
      <View style={{ gap: 14, marginTop: 8 }}>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        {mode === 'password' && <Field label="Password" value={secret} onChangeText={setSecret} secureTextEntry autoComplete="current-password" />}
        {mode === 'code' && sent && <Field label="6-digit code from your email" value={secret} onChangeText={setSecret} keyboardType="number-pad" autoComplete="one-time-code" />}
        {error && <Text size="sm" tone="bad" accessibilityRole="alert">{error}</Text>}
        <Button title={mode === 'password' ? 'Sign in' : sent ? 'Verify code' : 'Email me a code'} loading={busy} disabled={!email} onPress={submit} />
        <Pressable accessibilityRole="button" onPress={() => { setMode(mode === 'code' ? 'password' : 'code'); setSent(false); setSecret(''); setError(null); }}>
          <Text size="sm" tone="muted" style={{ textAlign: 'center' }}>{mode === 'code' ? 'Use a password instead' : 'Use a one-time email code instead'}</Text>
        </Pressable>
        <Row gap={10}><Button style={{ flex: 1 }} variant="secondary" title="Google" onPress={() => oauth('google')} /><Button style={{ flex: 1 }} variant="secondary" title="Apple" onPress={() => oauth('apple')} /></Row>
        <Text size="xs" tone="faint" style={{ textAlign: 'center' }}>No ID checks to join. We only verify your identity before your first withdrawal.</Text>
      </View>
      {DEMO && (
        <Card>
          <Text size="sm" weight="semibold" tone="muted">Demo logins</Text>
          <View style={{ gap: 8, marginTop: 10 }}>
            {DEMO_LOGINS.map(([label, mail]) => <Button key={mail} small variant="secondary" title={label} disabled={busy} onPress={() => run(() => supabase.auth.signInWithPassword({ email: mail, password: DEMO_PASSWORD }))} />)}
          </View>
        </Card>
      )}
    </Screen>
  );
}
