import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_KEY } from './onboarding';
import { supabase } from '@/lib/supabase';

export default function Index() {
  useEffect(() => {
    async function check() {
      const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!seen) {
        router.replace('/onboarding');
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth');
      }
    }
    check();
  }, []);
  return null;
}
