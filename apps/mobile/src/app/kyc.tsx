import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera, IdCard } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { TAX_ID_REQUIRED } from '@takeone/shared';
import { Button, Card, Field, Row, Screen, Text, toast, toastError } from '@/components/ui';
import { useMe, useUid } from '@/lib/data';
import { DEMO, rpc, supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

/** First-withdrawal identity check: ID photo + selfie (+ PAN in India). Mock provider approves instantly in demo mode. */
export default function Kyc() {
  const uid = useUid();
  const c = useColors();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const tax = TAX_ID_REQUIRED[me?.profile.country ?? ''];
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [taxId, setTaxId] = useState('');
  const [busy, setBusy] = useState(false);
  const taxError = tax && taxId && !tax.pattern.test(taxId.toUpperCase()) ? `Enter a valid ${tax.label}` : null;

  async function pick(kind: 'id' | 'selfie') {
    const r = kind === 'selfie' && (await ImagePicker.requestCameraPermissionsAsync()).granted
      ? await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) (kind === 'id' ? setIdPhoto : setSelfie)(r.assets[0].uri);
  }
  async function put(uri: string, name: string): Promise<string> {
    const path = `${uid}/${name}-${Date.now()}.jpg`;
    const body = uri.startsWith('demo:') ? new Blob([`demo ${name}`], { type: 'text/plain' }) : await (await fetch(uri)).blob();
    const { error } = await supabase.storage.from('kyc').upload(path, body, { contentType: uri.startsWith('demo:') ? 'text/plain' : 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    return path;
  }
  async function submit() {
    setBusy(true);
    try {
      const [idPath, selfiePath] = await Promise.all([put(idPhoto!, 'id'), put(selfie!, 'selfie')]);
      const status = await rpc<string>('submit_kyc', { p_id_path: idPath, p_selfie_path: selfiePath, p_tax_id: taxId || null });
      await qc.invalidateQueries({ queryKey: ['me'] });
      toast(status === 'verified' ? 'Identity verified. You can withdraw now.' : 'Submitted. We’ll confirm within a day.');
      router.back();
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  const Slot = ({ label, uri, onPress, icon }: { label: string; uri: string | null; onPress: () => void; icon: React.ReactNode }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ flex: 1, height: 130, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: uri ? c.ok : c.line, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden' }}>
      {uri && !uri.startsWith('demo:') ? <Image source={uri} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" /> : <>{icon}<Text size="sm" tone={uri ? 'ok' : 'muted'}>{uri ? `${label} added` : label}</Text></>}
    </Pressable>
  );
  return (
    <Screen edges={false} footer={<Button title="Verify and continue" disabled={!idPhoto || !selfie || (!!tax && !taxId) || !!taxError} loading={busy} onPress={submit} />}>
      <Text tone="muted">We only ask for this once, before your first withdrawal. Your documents are stored privately and never shown to brands.</Text>
      <Row gap={12}>
        <Slot label="ID photo" uri={idPhoto} onPress={() => pick('id')} icon={<IdCard size={26} color={c.muted} />} />
        <Slot label="Selfie" uri={selfie} onPress={() => pick('selfie')} icon={<Camera size={26} color={c.muted} />} />
      </Row>
      {tax && <Field label={`${tax.label} (required for payouts in India)`} value={taxId} onChangeText={(t) => setTaxId(t.toUpperCase())} autoCapitalize="characters" maxLength={10} placeholder="ABCDE1234F" error={taxError} />}
      {DEMO && <Card style={{ gap: 8 }}><Text size="sm" tone="muted">Demo mode: the provider is simulated and approves instantly.</Text><View><Button small variant="secondary" title="Use demo documents" onPress={() => { setIdPhoto('demo:id'); setSelfie('demo:selfie'); if (tax && !taxId) setTaxId('ABCDE1234F'); }} /></View></Card>}
    </Screen>
  );
}
