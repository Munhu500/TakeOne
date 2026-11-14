import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DUB_LANGUAGES, type Assignment } from '@takeone/shared';
import { Button, Chip, ProgressBar, Row, Text, toastError } from '@/components/ui';
import type { FeedCampaign } from '@/lib/campaigns';
import { useMe, useUid } from '@/lib/data';
import { DEMO, SUPABASE_URL, supabase } from '@/lib/supabase';
import { uploadResumable } from '@/lib/upload';

const SAMPLE = `${SUPABASE_URL}/storage/v1/object/public/public-assets/seed/sample-take.mp4`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function Shoot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const cam = useRef<CameraView>(null);
  const [camPerm, askCam] = useCameraPermissions();
  const [micPerm, askMic] = useMicrophonePermissions();
  const [step, setStep] = useState(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [take, setTake] = useState<{ uri: string; duration: number } | null>(null);
  const [consent, setConsent] = useState(true);
  const [lang, setLang] = useState('hi');
  const [progress, setProgress] = useState<number | null>(null);

  const q = useQuery({ queryKey: ['assignment', id], queryFn: async () => { const { data, error } = await supabase.from('assignments').select('*, campaigns(*, brands(name, logo))').eq('id', id).single(); if (error) throw new Error(error.message); return data as unknown as Assignment & { campaigns: FeedCampaign }; } });
  const likeness = useQuery({ queryKey: ['likeness', uid], enabled: !!uid, queryFn: async () => (await supabase.from('likeness_profiles').select('status').eq('creator_id', uid).maybeSingle()).data });
  useEffect(() => { if (!recording) return; const t = setInterval(() => setSeconds((s) => s + 1), 1000); return () => clearInterval(t); }, [recording]);

  const campaign = q.data?.campaigns;
  const shots = campaign?.shot_list.shots ?? [];
  const canRecord = Platform.OS !== 'web' && camPerm?.granted && micPerm?.granted;
  const usesAi = !!campaign?.brief.uses_ai_likeness && likeness.data?.status === 'ready';

  async function record() {
    if (recording) return cam.current?.stopRecording();
    setSeconds(0); setRecording(true);
    try {
      const res = await cam.current?.recordAsync({ maxDuration: 120 });
      if (res?.uri) setTake({ uri: res.uri, duration: seconds });
    } catch (e) { toastError(e); } finally { setRecording(false); }
  }
  async function pick() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) setTake({ uri: r.assets[0].uri, duration: 0 });
  }
  async function upload() {
    if (!take || !q.data) return;
    setProgress(0);
    try {
      if (usesAi) await supabase.from('likeness_consents').upsert({ creator_id: uid, campaign_id: q.data.campaign_id, granted_at: new Date().toISOString(), revoked_at: consent ? null : new Date().toISOString() }, { onConflict: 'creator_id,campaign_id' });
      const path = `${uid}/${q.data.id}-${Date.now()}.mp4`;
      await uploadResumable('takes', path, take.uri, 'video/mp4', setProgress);
      // inserting the take queues the product-in-frame check and the Variant Engine
      const { error } = await supabase.from('takes').insert({ assignment_id: q.data.id, storage_path: path, duration: take.duration || null, dub_language: me?.isPro ? lang : null });
      if (error) throw new Error(error.message);
      await qc.invalidateQueries({ queryKey: ['assignments', uid] });
      router.replace(`/studio/${q.data.id}`);
    } catch (e) { toastError(e); setProgress(null); }
  }

  if (take) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090B', paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingHorizontal: 20, gap: 16 }}>
        <Text size="xl" weight="bold" style={{ color: '#fff' }}>Send your take</Text>
        <Text size="sm" style={{ color: '#A1A1AA' }}>We check the product is clearly in frame, then build your variants. This usually takes a couple of minutes.</Text>
        {usesAi && (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={{ flexDirection: 'row', gap: 12, backgroundColor: '#1A1A1F', borderRadius: 16, padding: 14 }}>
            <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: consent ? '#7C5CFF' : '#71717A', backgroundColor: consent ? '#7C5CFF' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{consent && <Text size="sm" weight="bold" style={{ color: '#fff' }}>✓</Text>}</View>
            <View style={{ flex: 1 }}><Text size="sm" weight="semibold" style={{ color: '#fff' }}>Use my likeness for this campaign</Text><Text size="xs" style={{ color: '#A1A1AA' }}>Allows an AI scene version{me?.isPro ? ' and a language version in your cloned voice' : ''}. Only for {campaign?.brands.name}’s campaign, always labelled as AI, and you can revoke it for future uses.</Text></View>
          </Pressable>
        )}
        {me?.isPro && consent && usesAi && (
          <View style={{ gap: 8 }}><Text size="sm" weight="semibold" style={{ color: '#fff' }}>Language version (Pro)</Text><Row gap={8} style={{ flexWrap: 'wrap' }}>{DUB_LANGUAGES.slice(0, 4).map((l) => <Chip key={l.code} label={l.name} on={lang === l.code} onPress={() => setLang(l.code)} />)}</Row></View>
        )}
        <View style={{ flex: 1 }} />
        {progress !== null && <View style={{ gap: 8 }}><ProgressBar value={progress} /><Text size="xs" style={{ color: '#A1A1AA' }}>Uploading {Math.round(progress * 100)}% · safe to keep using your phone, the upload resumes if the connection drops.</Text></View>}
        <Row gap={10}><Button style={{ flex: 1 }} variant="secondary" title="Retake" disabled={progress !== null} onPress={() => setTake(null)} /><Button style={{ flex: 2 }} title="Upload take" loading={progress !== null} onPress={upload} /></Row>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {canRecord ? <CameraView ref={cam} style={{ position: 'absolute', width: '100%', height: '100%' }} facing="front" mode="video" /> : <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: '#111114' }} />}
      {/* framing guides: face zone and product zone */}
      <View pointerEvents="none" style={{ position: 'absolute', top: '16%', left: '18%', right: '18%', height: '34%', borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', borderStyle: 'dashed' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: '50%', right: '8%', width: '30%', height: '22%', borderRadius: 16, borderWidth: 2, borderColor: 'rgba(124,92,255,0.8)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}><Text size="xs" style={{ color: '#fff' }}>Product here</Text></View>

      <Row style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><X color="#fff" size={20} /></Pressable>
        <View style={{ backgroundColor: recording ? '#DC2626' : 'rgba(0,0,0,0.5)', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8 }}><Text weight="semibold" style={{ color: '#fff', fontVariant: ['tabular-nums'] }}>{recording ? '● ' : ''}{mmss(seconds)}</Text></View>
        <View style={{ width: 40 }} />
      </Row>

      <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, gap: 14 }}>
        {shots[step] && (
          <View style={{ backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 18, padding: 14, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text size="xs" weight="semibold" style={{ color: '#A78BFA' }}>SHOT {step + 1} OF {shots.length} · {shots[step]!.seconds}s</Text>
              <Row gap={4}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous shot" disabled={step === 0} onPress={() => setStep(step - 1)} style={{ padding: 4, opacity: step === 0 ? 0.3 : 1 }}><ChevronLeft color="#fff" size={20} /></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Next shot" disabled={step >= shots.length - 1} onPress={() => setStep(step + 1)} style={{ padding: 4, opacity: step >= shots.length - 1 ? 0.3 : 1 }}><ChevronRight color="#fff" size={20} /></Pressable>
              </Row>
            </Row>
            <Text weight="semibold" style={{ color: '#fff' }}>{shots[step]!.title}</Text>
            <Text size="sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{shots[step]!.direction}</Text>
            {campaign?.shot_list.talking_points[step] && <Text size="xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Talking point: {campaign.shot_list.talking_points[step]}</Text>}
          </View>
        )}
        {canRecord ? (
          <View style={{ alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={recording ? 'Stop recording' : 'Start recording'} onPress={record} style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: recording ? 30 : 60, height: recording ? 30 : 60, borderRadius: recording ? 8 : 30, backgroundColor: '#EF4444' }} />
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {Platform.OS !== 'web' && <Button title="Allow camera and microphone" onPress={async () => { await askCam(); await askMic(); }} />}
            {Platform.OS === 'web' && <Text size="sm" style={{ color: '#A1A1AA', textAlign: 'center' }}>Recording needs the iOS or Android app. On the web you can upload a take.</Text>}
            <Button variant="secondary" title="Upload a video" onPress={pick} />
          </View>
        )}
        {DEMO && !recording && <Button variant="ghost" small title="Demo: use the sample take" onPress={() => setTake({ uri: SAMPLE, duration: 24 })} />}
      </View>
    </View>
  );
}
