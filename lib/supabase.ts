import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Type definitions matching database tables ──────────────────────────────

export type Bill = {
  id: string;
  user_profile: 'mom' | 'dad';
  name: string;
  amount: number;
  due_date: string;
  icon: string;
  status: 'pending' | 'paid' | 'overdue';
  created_at: string;
};

export type HomeTask = {
  id: string;
  user_profile: 'mom' | 'dad';
  title: string;
  category: 'maintenance' | 'repair';
  frequency?: string;
  due_date?: string;
  status: 'open' | 'done';
  created_at: string;
};

export type MealPlan = {
  id: string;
  user_profile: 'mom' | 'dad';
  day_of_week: number; // 0 = Monday
  week_start: string; // ISO date of Monday
  meal_name: string;
  icon: string;
  created_at: string;
};

export type GroceryItem = {
  id: string;
  user_profile: 'mom' | 'dad';
  name: string;
  quantity?: string;
  estimated_price?: number;
  checked: boolean;
  created_at: string;
};

export type BibleReading = {
  id: string;
  user_profile: 'mom' | 'dad';
  plan_id: string;
  passage: string;
  verse_count: number;
  completed: boolean;
  scheduled_date: string;
};

export type PrayerEntry = {
  id: string;
  user_profile: 'mom' | 'dad';
  content: string;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  user_profile: 'mom' | 'dad';
  title: string;
  date: string; // ISO date
  time?: string;
  color: string;
  category: 'personal' | 'family' | 'oikonomos' | 'work';
};
