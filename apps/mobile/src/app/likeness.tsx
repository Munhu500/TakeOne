import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, ShieldCheck } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { LIKENESS_CONSENT_VERSION } from '@takeone/shared';
import { Badge, Button, Card, ProgressBar, Row, Screen, Text, toast, toastError } from '@/components/ui';
import { useUid } from '@/lib/data';
import { DEMO, rpc, supabase } from '@/lib/supabase';
import { uploadResumable } from '@/lib/upload';
import { useColors } from '@/lib/theme';

const PROMISES = ['Used only with your consent, campaign by campaign', 'Never used outside a campaign you signed', 'Revocable at any time for future uses', 'Deleted on request, including your voice clone', 'Every AI scene or voice version is labelled as AI'];
const STEPS = [
  { title: 'Face forward', hint: 'Look straight at the camera for 20 seconds. Neutral, then smile.', seconds: 20 },
  { title: 'Turn left and right', hint: 'Slowly turn your head left, then right, then up and down.', seconds: 30 },
  { title: 'Read the script', hint: '“Hi, this is my real voice. I only say what I honestly think about a product, and I never read claims I can’t stand behind. The quick brown fox jumps over the lazy dog.”', seconds: 60 },
];

export default function Likeness() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const uid = useUid();
  const c = useColors();
  const qc = useQueryClient();
  const cam = useRef<CameraView>(null);
  const [camPerm, askCam] = useCameraPermissions();
  const [micPerm, askMic] = useMicrophonePermissions();
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState(-1);
  const [recording, setRecording] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['likeness', uid], enabled: !!uid, queryFn: async () => (await supabase.from('likeness_profiles').select('*').eq('creator_id', uid).maybeSingle()).data });
  const consents = useQuery({ queryKey: ['consents', uid], enabled: !!uid, queryFn: async () => (await supabase.from('likeness_consents').select('*, campaigns(title)').eq('creator_id', uid).order('granted_at', { ascending: false })).data ?? [] });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['likeness', uid] }), qc.invalidateQueries({ queryKey: ['consents', uid] })]);
  const canRecord = Platform.OS !== 'web' && camPerm?.granted && micPerm?.granted;
  const leave = () => (onboarding ? router.replace('/(tabs)') : router.back());

  async function finish(captures: string[]) {
    setBusy(true);
    try { await rpc('setup_likeness', { p_capture_paths: captures }); await refresh(); toast('Likeness Vault is set up.'); setStep(-1); if (onboarding) router.replace('/(tabs)'); } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  async function capture() {
    if (recording) return cam.current?.stopRecording();
    setRecording(true);
    try {
      const res = await cam.current?.recordAsync({ maxDuration: STEPS[step]!.seconds });
      if (res?.uri) {
        const path = `${uid}/capture-${step}-${Date.now()}.mp4`;
        await uploadResumable('likeness', path, res.uri, 'video/mp4'); // private bucket, owner-only
        const next = [...paths, path];
        setPaths(next);
        if (step === STEPS.length - 1) await finish(next); else setStep(step + 1);
      }
    } catch (e) { toastError(e); } finally { setRecording(false); }
  }
  async function revoke() {
    setBusy(true);
    try {
      const files = (q.data?.capture_paths ?? []) as string[];
      if (files.length) await supabase.storage.from('likeness').remove(files);
      await rpc('revoke_likeness'); await refresh(); toast('Revoked. Your captures and voice clone were deleted.');
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }

  if (step >= 0) {
    const s = STEPS[step]!;
    return (
      <Screen edges={false} scroll={false}>
        <ProgressBar value={(step + 1) / STEPS.length} />
        <Text size="lg" weight="bold" style={{ marginTop: 14 }}>{step + 1}. {s.title}</Text>
        <Text tone="muted" size="sm" style={{ marginTop: 6 }}>{s.hint}</Text>
        <View style={{ flex: 1, marginVertical: 16, borderRadius: 22, overflow: 'hidden', backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' }}>
          {canRecord ? <CameraView ref={cam} style={{ width: '100%', height: '100%' }} facing="front" mode="video" /> : <Text tone="muted" size="sm" style={{ padding: 24, textAlign: 'center' }}>{Platform.OS === 'web' ? 'Capture needs the iOS or Android app.' : 'Camera and microphone access are needed for the capture.'}</Text>}
        </View>
        {canRecord ? <Button title={recording ? 'Stop' : `Record (${s.seconds}s)`} variant={recording ? 'danger' : 'primary'} onPress={capture} /> : Platform.OS !== 'web' ? <Button title="Allow camera and microphone" onPress={async () => { await askCam(); await askMic(); }} /> : null}
        {DEMO && <Button variant="ghost" small title="Demo: skip capture and finish" loading={busy} onPress={() => finish(paths)} />}
      </Screen>
    );
  }
  const ready = q.data?.status === 'ready';
  return (
    <Screen edges={false} footer={!ready ? <Row gap={10}>{onboarding && <Button style={{ flex: 1 }} variant="secondary" title="Later" onPress={leave} />}<Button style={{ flex: 2 }} title="Start 3–5 minute capture" disabled={!agreed} onPress={() => setStep(0)} /></Row> : onboarding ? <Button title="Continue" onPress={leave} /> : undefined}>
      <Row gap={10}><ShieldCheck size={22} color={c.accent} /><Text size="lg" weight="bold" style={{ flex: 1 }}>Your face and voice stay yours</Text></Row>
      <Text tone="muted" size="sm">The Likeness Vault lets the Variant Engine place you in a new scene or dub your real review into another language. It is optional and free for every creator.</Text>
      <Card style={{ gap: 10 }}>{PROMISES.map((p) => <Row key={p} gap={10} style={{ alignItems: 'flex-start' }}><Check size={16} color={c.ok} style={{ marginTop: 2 }} /><Text size="sm" style={{ flex: 1 }}>{p}</Text></Row>)}</Card>
      {ready ? (
        <>
          <Card style={{ gap: 8 }}><Badge tone="ok" label="Vault ready" /><Text size="sm" tone="muted">Voice clone on file. You’ll be asked for consent on each campaign before anything is generated.</Text></Card>
          <Text size="sm" tone="muted" weight="semibold">CAMPAIGN CONSENTS</Text>
          {(consents.data ?? []).length === 0 && <Text size="sm" tone="faint">No consents given yet.</Text>}
          {(consents.data ?? []).map((k) => (
            <Card key={k.id}><Row style={{ justifyContent: 'space-between' }}><Text size="sm" weight="medium" style={{ flex: 1 }} numberOfLines={1}>{(k.campaigns as { title: string } | null)?.title}</Text>
              {k.revoked_at ? <Badge tone="bad" label="Revoked" /> : <Button small variant="ghost" title="Revoke" onPress={async () => { const { error } = await supabase.from('likeness_consents').update({ revoked_at: new Date().toISOString() }).eq('id', k.id); if (error) toastError(new Error(error.message)); else { await refresh(); toast('Consent revoked for future uses.'); } }} />}</Row></Card>
          ))}
          <Button variant="danger" title="Revoke and delete my likeness" loading={busy} onPress={revoke} />
        </>
      ) : (
        <Button variant={agreed ? 'secondary' : 'primary'} title={agreed ? `Consent given (v${LIKENESS_CONSENT_VERSION})` : 'I understand and consent to set up my vault'} icon={agreed ? <Check size={16} color={c.ok} /> : undefined} onPress={() => setAgreed(!agreed)} />
      )}
    </Screen>
  );
}
