import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Button, Empty, Skeleton } from '@/components/ui';
import { useAuth, useMe } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

export default function Gate() {
  const { session, loading } = useAuth();
  const me = useMe();
  const c = useColors();
  if (loading || (session && me.isLoading)) return <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, paddingTop: 120, gap: 14 }}><Skeleton height={32} width="60%" /><Skeleton height={420} /></View>;
  if (!session) return <Redirect href="/sign-in" />;
  if (me.error || !me.data) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><Empty title="Couldn’t load your profile" body={me.error?.message} action={<Button small variant="secondary" title="Sign out" onPress={() => supabase.auth.signOut()} />} /></View>;
  if (me.data.profile.role !== 'creator') return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><Empty title="This app is for creators" body="Brands and agencies use the web dashboard." action={<Button small variant="secondary" title="Sign out" onPress={() => supabase.auth.signOut()} />} /></View>;
  return <Redirect href={me.data.profile.onboarded ? '/(tabs)' : '/onboarding'} />;
}
