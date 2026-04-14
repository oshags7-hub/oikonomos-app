import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { ProfileToggle } from '@/components/ProfileToggle';
import { AIInsightCard } from '@/components/AIInsightCard';
import { Card } from '@/components/Card';
import { getInsight } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import { fetchVerseOfDay } from '@/lib/esv';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

type Stats = {
  billsPending: number;
  billsOverdue: number;
  tasksDue: number;
  bibleReadings: number;
  bibleTotal: number;
  shoppingItems: number;
};

export default function DashboardScreen() {
  const { profile, theme } = useProfile();
  const { user } = useAuth();
  const [insight, setInsight] = useState('Loading your daily briefing...');
  const [insightLoading, setInsightLoading] = useState(true);
  const [verse, setVerse] = useState({ text: '"She watches over the affairs of her household and does not eat the bread of idleness."', reference: 'Proverbs 31:27' });
  const [stats, setStats] = useState<Stats>({ billsPending: 0, billsOverdue: 0, tasksDue: 0, bibleReadings: 0, bibleTotal: 3, shoppingItems: 0 });

  const userId = user?.id;

  const loadStats = useCallback(async () => {
    if (!userId) return;

    const [billsRes, shoppingRes] = await Promise.all([
      supabase.from('bills').select('status').eq('user_id', userId),
      supabase.from('shopping_items').select('id').eq('user_id', userId).eq('checked', false),
    ]);

    const billsPending = billsRes.data?.filter(b => b.status === 'pending').length ?? 0;
    const billsOverdue = billsRes.data?.filter(b => b.status === 'overdue').length ?? 0;
    const shoppingItems = shoppingRes.data?.length ?? 0;

    setStats(prev => ({ ...prev, billsPending, billsOverdue, shoppingItems }));
  }, [userId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    fetchVerseOfDay().then(v => {
      if (v) setVerse({ text: `"${v.text}"`, reference: v.reference });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setInsightLoading(true);
      try {
        const text = await getInsight({
          screen: 'dashboard',
          data: {
            profile,
            bills_overdue: stats.billsOverdue,
            bills_pending: stats.billsPending,
            shopping_items: stats.shoppingItems,
          },
        });
        if (!cancelled) setInsight(text);
      } catch {
        if (!cancelled) setInsight('Have a blessed and productive day managing your household!');
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [profile, stats.billsOverdue]);

  const statCards = [
    {
      icon: '💳',
      value: stats.billsPending.toString(),
      label: 'Bills pending',
      sub: stats.billsOverdue > 0 ? `${stats.billsOverdue} overdue` : 'All on track',
      route: '/(tabs)/finance',
      urgent: stats.billsOverdue > 0,
    },
    {
      icon: '🏠',
      value: stats.tasksDue.toString(),
      label: 'Tasks due',
      sub: stats.tasksDue > 0 ? 'Tap to view' : 'Nothing urgent',
      route: '/(tabs)/home',
      urgent: stats.tasksDue > 0,
    },
    {
      icon: '📖',
      value: `${stats.bibleReadings}/${stats.bibleTotal}`,
      label: 'Bible readings',
      sub: stats.bibleReadings > 0 ? 'Keep going 🔥' : 'Start today',
      route: '/(tabs)/bible',
      urgent: false,
    },
    {
      icon: '🛒',
      value: stats.shoppingItems.toString(),
      label: 'To buy',
      sub: stats.shoppingItems > 0 ? 'Items remaining' : 'List is clear',
      route: '/(tabs)/meals',
      urgent: false,
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <View>
          <Text style={[styles.wordmark, { color: theme.text }]}>
            Oikonom<Text style={{ color: theme.accent }}>os</Text>
          </Text>
          <Text style={[styles.wordmarkSub, { color: theme.textSub }]}>HOUSEHOLD STEWARD</Text>
        </View>
        <ProfileToggle />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: theme.heroBackground }]}>
          <Text style={[styles.heroGreet, { color: theme.heroSub }]}>{greeting()}</Text>
          <Text style={[styles.heroWordmark, { color: theme.heroText }]}>Oikonomos</Text>
          <Text style={[styles.heroTag, { color: theme.heroSub }]}>Your household, beautifully managed</Text>
        </View>

        {/* AI Briefing */}
        <AIInsightCard text={insight} loading={insightLoading} />

        {/* Stat grid — each card is tappable */}
        <View style={styles.statGrid}>
          {statCards.map((s) => (
            <TouchableOpacity
              key={s.label}
              onPress={() => router.push(s.route as any)}
              activeOpacity={0.75}
              style={{ width: '47%' }}
            >
              <Card style={[styles.statCard, s.urgent && { borderWidth: 1.5, borderColor: '#E53935' + '40' }]}>
                <Text style={styles.statIcon}>{s.icon}</Text>
                <Text style={[styles.statValue, { color: s.urgent ? '#E53935' : theme.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: theme.text }]}>{s.label}</Text>
                <Text style={[styles.statSub, { color: s.urgent ? '#E53935' : theme.textSub }]}>{s.sub}</Text>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        {/* Verse */}
        <View style={[styles.verseCard, { backgroundColor: theme.verseBackground, borderColor: theme.verseBorder }]}>
          <Text style={[styles.verseLabel, { color: theme.verseLabel }]}>SCRIPTURE</Text>
          <Text style={[styles.verseText, { color: theme.verseText }]}>{verse.text}</Text>
          <Text style={[styles.verseRef, { color: theme.verseRef }]}>{verse.reference}</Text>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
  },
  wordmark: { fontSize: 19, fontWeight: '600', letterSpacing: 0.4 },
  wordmarkSub: { fontSize: 9, fontWeight: '600', letterSpacing: 1.2, marginTop: 1 },
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28 },
  heroGreet: { fontSize: 13, fontWeight: '500' },
  heroWordmark: {
    fontSize: 44, fontWeight: '800', letterSpacing: -2, lineHeight: 48, marginTop: 10,
  },
  heroTag: { fontSize: 12, marginTop: 4 },
  statGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 16, marginTop: 14,
  },
  statCard: { padding: 14 },
  statIcon: { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statSub: { fontSize: 11, marginTop: 1 },
  verseCard: {
    borderRadius: 16, marginHorizontal: 16, marginTop: 14, padding: 16, borderWidth: 1,
  },
  verseLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  verseText: { fontSize: 16, lineHeight: 28, fontStyle: 'italic' },
  verseRef: { fontSize: 11, fontWeight: '600', marginTop: 8 },
});
