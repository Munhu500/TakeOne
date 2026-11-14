import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Send, ShieldAlert } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MASKING_NOTICE, maskContactInfo, type Message } from '@takeone/shared';
import { Empty, Row, Text, toastError } from '@/components/ui';
import { timeAgo, useUid } from '@/lib/data';
import { rpc, supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

/** Campaign chat with the brand. Contact details are masked by the database before a message is saved. */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const c = useColors();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Message>>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const key = ['messages', id, uid];
  const q = useQuery({ queryKey: key, enabled: !!uid, refetchInterval: 8000, queryFn: async () => ((await supabase.from('messages').select('*').eq('campaign_id', id).eq('creator_id', uid).order('created_at')).data ?? []) as Message[] });
  useEffect(() => {
    const ch = supabase.channel(`chat:${id}:${uid}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `campaign_id=eq.${id}` }, () => qc.invalidateQueries({ queryKey: key })).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, uid]);
  const willMask = text.trim() ? maskContactInfo(text).hadMasking : false;

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const m = await rpc<Message>('send_message', { p_campaign_id: id, p_creator_id: uid, p_body: text.trim() });
      qc.setQueryData<Message[]>(key, (cur) => [...(cur ?? []).filter((x) => x.id !== m.id), m]);
      setText('');
    } catch (e) { toastError(e); } finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList ref={list} data={q.data ?? []} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }} onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Empty title="No messages yet" body="Ask about shipping or the brief here. Keep contact details and payments on TakeOne." />}
        renderItem={({ item: m }) => {
          const mine = m.sender_id === uid;
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
              <View style={{ maxWidth: '82%', backgroundColor: mine ? c.accent : c.raised, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 }}><Text size="sm" tone={mine ? 'accentFg' : 'fg'}>{m.body_masked}</Text></View>
              {m.had_masking && <Row gap={4} style={{ maxWidth: '82%' }}><ShieldAlert size={12} color={c.warn} /><Text size="xs" tone="warn" style={{ flex: 1 }}>{MASKING_NOTICE}</Text></Row>}
              <Text size="xs" tone="faint">{timeAgo(m.created_at)}</Text>
            </View>
          );
        }} />
      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 8, borderTopWidth: 1, borderTopColor: c.line, gap: 6 }}>
        {willMask && <Text size="xs" tone="warn">Contact details and off-platform requests will be hidden before this is sent.</Text>}
        <Row gap={8}>
          <TextInput accessibilityLabel="Message" value={text} onChangeText={setText} placeholder="Message the brand" placeholderTextColor={c.faint} maxLength={2000} multiline style={{ flex: 1, backgroundColor: c.raised, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: c.fg, fontFamily: 'Inter_400Regular', fontSize: 15, maxHeight: 120 }} />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={busy || !text.trim()} onPress={send} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() ? 0.4 : 1 }}><Send size={18} color="#fff" /></Pressable>
        </Row>
      </View>
    </KeyboardAvoidingView>
  );
}
