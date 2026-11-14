import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/ui';
import { AuthProvider } from '@/lib/data';
import { useColors } from '@/lib/theme';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const c = useColors();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style={c.bg === '#09090B' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerStyle: { backgroundColor: c.bg }, headerTintColor: c.fg, headerTitleStyle: { fontFamily: 'Inter_600SemiBold' }, headerShadowVisible: false, contentStyle: { backgroundColor: c.bg }, headerBackButtonDisplayMode: 'minimal' }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="sign-in" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="campaign/[id]" options={{ title: '' , headerTransparent: true }} />
              <Stack.Screen name="shoot/[id]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
              <Stack.Screen name="studio/[id]" options={{ title: 'Studio' }} />
              <Stack.Screen name="chat/[id]" options={{ title: 'Messages' }} />
              <Stack.Screen name="withdraw" options={{ title: 'Withdraw', presentation: 'modal' }} />
              <Stack.Screen name="kyc" options={{ title: 'Verify your identity', presentation: 'modal' }} />
              <Stack.Screen name="pro" options={{ title: 'TakeOne Pro', presentation: 'modal' }} />
              <Stack.Screen name="socials" options={{ title: 'Social accounts' }} />
              <Stack.Screen name="likeness" options={{ title: 'Likeness Vault' }} />
            </Stack>
            <ToastHost />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
