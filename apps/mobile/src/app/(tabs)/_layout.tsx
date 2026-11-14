import { Tabs } from 'expo-router';
import { Clapperboard, Home, Trophy, User, Wallet } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { useColors } from '@/lib/theme';

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: c.fg, tabBarInactiveTintColor: c.faint, tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }, tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 } }}>
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="work" options={{ title: 'My work', tabBarIcon: ({ color, size }) => <Clapperboard color={color} size={size} /> }} />
      <Tabs.Screen name="leaderboard" options={{ title: 'Board', tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} /> }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
