import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';
import { AuthProvider } from '@/contexts/AuthContext';

function RootLayoutInner() {
  const { profile } = useProfile();

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      console.log('Deep link received:', url);
    };
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={profile === 'mom' ? 'dark' : 'light'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <RootLayoutInner />
      </ProfileProvider>
    </AuthProvider>
  );
}
