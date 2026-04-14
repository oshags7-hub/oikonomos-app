import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView,
  Platform, Share, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from '@/contexts/ProfileContext';
import { AIInsightCard } from '@/components/AIInsightCard';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { SectionHeader } from '@/components/SectionHeader';
import { getInsight } from '@/lib/anthropic';
import { fetchPassage, fetchVerseOfDay } from '@/lib/esv';
import { READING_PLANS, getPlanById, getTodayDayNumber, type ReadingPlan } from '@/lib/readingPlans';
import { supabase } from '@/lib/supabase';

type SubTab = 'today' | 'prayer' | 'plans';
type PrayerCategory = 'family' | 'health' | 'church' | 'personal' | 'world';

const PLAN_STORAGE_KEY = 'oikonomos_bible_plan';
const STREAK_KEY = 'oikonomos_bible_streak';
const LAST_READ_KEY = 'oikonomos_last_read_date';

const CATEGORY_LABELS: Record<PrayerCategory, string> = {
  family: '👨‍👩‍👧 Family',
  health: '🏥 Health',
  church: '⛪ Church',
  personal: '🙏 Personal',
  world: '🌍 World',
};

const CATEGORY_VARIANTS: Record<PrayerCategory, 'green' | 'amber' | 'purple' | 'neutral' | 'red'> = {
  family: 'green',
  health: 'amber',
  church: 'purple',
  personal: 'neutral',
  world: 'red',
};

type PrayerRequest = {
  id: string;
  title: string;
  details?: string;
  category: PrayerCategory;
  answered: boolean;
  created_at: string;
  answer_notes?: string;
};

type ReadingItem = {
  passage: string;
  done: boolean;
};

export default function BibleScreen() {
  const { profile, theme } = useProfile();
  const [activeTab, setActiveTab] = useState<SubTab>('today');

  // Bible state
  const [activePlan, setActivePlan] = useState<ReadingPlan | null>(null);
  const [planStartDate, setPlanStartDate] = useState<string>('');
  const [dayNumber, setDayNumber] = useState(1);
  const [readings, setReadings] = useState<ReadingItem[]>([]);
  const [streak, setStreak] = useState(0);
  const [verseOfDay, setVerseOfDay] = useState({ text: '', ref: '' });
  const [verseLoading, setVerseLoading] = useState(true);
  const [passageText, setPassageText] = useState('');
  const [passageLoading, setPassageLoading] = useState(false);
  const [selectedPassage, setSelectedPassage] = useState('');
  const [passageModalVisible, setPassageModalVisible] = useState(false);

  // Prayer state
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [prayerModalVisible, setPrayerModalVisible] = useState(false);
  const [answerModalId, setAnswerModalId] = useState<string | null>(null);
  const [newPrayer, setNewPrayer] = useState({ title: '', details: '', category: 'personal' as PrayerCategory });
  const [answerNotes, setAnswerNotes] = useState('');
  const [filterAnswered, setFilterAnswered] = useState(false);

  // AI
  const [insight, setInsight] = useState("Today's readings hold a beautiful thread of grace — look for how each passage points to Christ's faithfulness.");
  const [insightLoading, setInsightLoading] = useState(false);

  // Load plan from storage
  useEffect(() => {
    async function load() {
      const stored = await AsyncStorage.getItem(PLAN_STORAGE_KEY);
      if (stored) {
        const { planId, startDate } = JSON.parse(stored);
        const plan = getPlanById(planId);
        if (plan) {
          setActivePlan(plan);
          setPlanStartDate(startDate);
          const day = getTodayDayNumber(startDate);
          setDayNumber(day);
          const passages = plan.getPassages(day);
          setReadings(passages.map(p => ({ passage: p, done: false })));
        }
      }
      const streakVal = await AsyncStorage.getItem(STREAK_KEY);
      setStreak(parseInt(streakVal ?? '0', 10));
    }
    load();
  }, []);

  // Load verse of day
  useEffect(() => {
    setVerseLoading(true);
    fetchVerseOfDay()
      .then(setVerseOfDay)
      .finally(() => setVerseLoading(false));
  }, []);

  // Load prayers
  const loadPrayers = useCallback(async () => {
    const { data } = await supabase
      .from('prayer_requests')
      .select('*')
      .eq('user_profile', profile)
      .order('created_at', { ascending: false });
    if (data) setPrayers(data as PrayerRequest[]);
  }, [profile]);

  useEffect(() => { loadPrayers(); }, [loadPrayers]);

  // Load AI insight when tab changes
  useEffect(() => {
    if (activeTab !== 'today' || !activePlan) return;
    let cancelled = false;
    async function load() {
      setInsightLoading(true);
      try {
        const text = await getInsight({
          screen: 'bible',
          data: { readings: readings.map(r => r.passage), plan: activePlan?.title, day: dayNumber },
        });
        if (!cancelled) setInsight(text);
      } catch { /* keep default */ }
      finally { if (!cancelled) setInsightLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [activeTab, activePlan]);

  async function selectPlan(plan: ReadingPlan) {
    const startDate = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ planId: plan.id, startDate }));
    setActivePlan(plan);
    setPlanStartDate(startDate);
    setDayNumber(1);
    const passages = plan.getPassages(1);
    setReadings(passages.map(p => ({ passage: p, done: false })));
    setActiveTab('today');
  }

  async function toggleReading(idx: number) {
    const updated = readings.map((r, i) => i === idx ? { ...r, done: !r.done } : r);
    setReadings(updated);

    // Update streak if all done
    if (updated.every(r => r.done)) {
      const today = new Date().toISOString().split('T')[0];
      const lastRead = await AsyncStorage.getItem(LAST_READ_KEY);
      if (lastRead !== today) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        await AsyncStorage.setItem(STREAK_KEY, String(newStreak));
        await AsyncStorage.setItem(LAST_READ_KEY, today);
      }
    }
  }

  async function openPassage(passage: string) {
    setSelectedPassage(passage);
    setPassageModalVisible(true);
    setPassageLoading(true);
    setPassageText('');
    const text = await fetchPassage(passage);
    setPassageText(text);
    setPassageLoading(false);
  }

  async function savePrayer() {
    if (!newPrayer.title.trim()) return;
    await supabase.from('prayer_requests').insert({
      user_profile: profile,
      title: newPrayer.title,
      details: newPrayer.details || null,
      category: newPrayer.category,
    });
    setNewPrayer({ title: '', details: '', category: 'personal' });
    setPrayerModalVisible(false);
    loadPrayers();
  }

  async function markAnswered(id: string) {
    await supabase.from('prayer_requests').update({
      answered: true,
      answered_date: new Date().toISOString(),
      answer_notes: answerNotes,
    }).eq('id', id);
    setAnswerNotes('');
    setAnswerModalId(null);
    loadPrayers();
  }

  async function deletePrayer(id: string) {
    await supabase.from('prayer_requests').delete().eq('id', id);
    loadPrayers();
  }

  async function sharePrayer(p: PrayerRequest) {
    await Share.share({
      message: `Please pray with me:\n\n${p.title}${p.details ? `\n\n${p.details}` : ''}\n\nShared from Oikonomos`,
    });
  }

  const completedCount = readings.filter(r => r.done).length;
  const progress = activePlan ? Math.round((dayNumber / activePlan.totalDays) * 100) : 0;

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'prayer', label: 'Prayer' },
    { key: 'plans', label: 'Plans' },
  ];

  const visiblePrayers = prayers.filter(p => p.answered === filterAnswered);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Bible</Text>
          <Text style={[styles.pageSub, { color: theme.textSub }]}>
            {activePlan ? `${activePlan.title} · Day ${dayNumber}` : 'Choose a reading plan'}
          </Text>
        </View>
      </View>

      <View style={[styles.subTabs, { backgroundColor: theme.surfaceAlt }]}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.subTab, activeTab === t.key && { backgroundColor: theme.surface }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.subTabText, { color: activeTab === t.key ? theme.text : theme.textSub }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── TODAY TAB ── */}
        {activeTab === 'today' && (
          <>
            {/* Verse of day */}
            <View style={[styles.verseCard, { backgroundColor: theme.verseBackground, borderColor: theme.verseBorder }]}>
              <Text style={[styles.verseLabel, { color: theme.verseLabel }]}>VERSE OF THE DAY</Text>
              {verseLoading ? (
                <ActivityIndicator color={theme.verseLabel} style={{ marginVertical: 8 }} />
              ) : (
                <>
                  <Text style={[styles.verseText, { color: theme.verseText }]}>{verseOfDay.text || '"She is clothed with strength and dignity, and she laughs without fear of the future."'}</Text>
                  <Text style={[styles.verseRef, { color: theme.verseRef }]}>{verseOfDay.ref || 'Proverbs 31:25'}</Text>
                </>
              )}
            </View>

            {/* Progress */}
            {activePlan && (
              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={[styles.progressLabel, { color: theme.textSub }]}>{activePlan.title} progress</Text>
                  <Text style={[styles.progressPct, { color: theme.text }]}>{progress}%</Text>
                </View>
                <View style={[styles.progressBg, { backgroundColor: theme.progressBg }]}>
                  <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.progressBar }]} />
                </View>
                <Text style={[styles.progressSub, { color: theme.textSub }]}>
                  Day {dayNumber} of {activePlan.totalDays} · {streak > 0 ? `${streak}-day streak 🔥` : 'Start your streak today'}
                </Text>
              </View>
            )}

            {/* Today's readings */}
            {readings.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title="Today's readings" />
                <Card noPad>
                  {readings.map((r, i) => (
                    <View
                      key={r.passage}
                      style={[styles.readingRow, { borderBottomColor: theme.borderLight }, i === readings.length - 1 && { borderBottomWidth: 0 }]}
                    >
                      <TouchableOpacity
                        style={[styles.check, { borderColor: r.done ? 'transparent' : theme.border }, r.done && { backgroundColor: theme.sage }]}
                        onPress={() => toggleReading(i)}
                      >
                        {r.done && <Text style={styles.checkMark}>✓</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={{ flex: 1, marginLeft: 10 }} onPress={() => openPassage(r.passage)}>
                        <Text style={[styles.readingPassage, { color: theme.text, textDecorationLine: r.done ? 'line-through' : 'none', opacity: r.done ? 0.45 : 1 }]}>
                          {r.passage}
                        </Text>
                        <Text style={[styles.readingSub, { color: theme.accent }]}>Tap to read →</Text>
                      </TouchableOpacity>
                      <Chip label={r.done ? 'Done' : 'Unread'} variant={r.done ? 'green' : 'neutral'} />
                    </View>
                  ))}
                </Card>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.noPlanCard, { backgroundColor: theme.accentSoft, borderColor: theme.border }]}
                onPress={() => setActiveTab('plans')}
              >
                <Text style={styles.noPlanEmoji}>📖</Text>
                <Text style={[styles.noPlanTitle, { color: theme.text }]}>Choose a reading plan</Text>
                <Text style={[styles.noPlanSub, { color: theme.textSub }]}>Tap to browse plans →</Text>
              </TouchableOpacity>
            )}

            <AIInsightCard text={insight} loading={insightLoading} />
          </>
        )}

        {/* ── PRAYER TAB ── */}
        {activeTab === 'prayer' && (
          <View style={styles.section}>
            {/* Filter toggle */}
            <View style={[styles.filterRow, { backgroundColor: theme.surfaceAlt }]}>
              <TouchableOpacity
                style={[styles.filterBtn, !filterAnswered && { backgroundColor: theme.surface }]}
                onPress={() => setFilterAnswered(false)}
              >
                <Text style={[styles.filterBtnText, { color: !filterAnswered ? theme.text : theme.textSub }]}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, filterAnswered && { backgroundColor: theme.surface }]}
                onPress={() => setFilterAnswered(true)}
              >
                <Text style={[styles.filterBtnText, { color: filterAnswered ? theme.text : theme.textSub }]}>Answered ✓</Text>
              </TouchableOpacity>
            </View>

            <SectionHeader
              title={filterAnswered ? 'Answered prayers' : 'Prayer requests'}
              action="+ New"
              onAction={() => setPrayerModalVisible(true)}
            />

            {visiblePrayers.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: theme.surfaceAlt }]}>
                <Text style={styles.emptyEmoji}>{filterAnswered ? '🎉' : '🙏'}</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  {filterAnswered ? 'No answered prayers yet' : 'No prayer requests'}
                </Text>
                <Text style={[styles.emptySub, { color: theme.textSub }]}>
                  {filterAnswered ? 'Mark prayers as answered when God moves' : 'Tap + New to add your first prayer request'}
                </Text>
              </View>
            )}

            {visiblePrayers.map((p) => (
              <View key={p.id} style={[styles.prayerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.prayerHeader}>
                  <Chip label={CATEGORY_LABELS[p.category]} variant={CATEGORY_VARIANTS[p.category]} />
                  <Text style={[styles.prayerDate, { color: theme.textSub }]}>
                    {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <Text style={[styles.prayerTitle, { color: theme.text }]}>{p.title}</Text>
                {p.details && <Text style={[styles.prayerDetails, { color: theme.textSub }]}>{p.details}</Text>}
                {p.answer_notes && (
                  <View style={[styles.answerNote, { backgroundColor: theme.chipGreenBg }]}>
                    <Text style={[styles.answerNoteText, { color: theme.chipGreenText }]}>✓ {p.answer_notes}</Text>
                  </View>
                )}
                <View style={styles.prayerActions}>
                  {!p.answered && (
                    <TouchableOpacity
                      style={[styles.prayerBtn, { backgroundColor: theme.chipGreenBg }]}
                      onPress={() => setAnswerModalId(p.id)}
                    >
                      <Text style={[styles.prayerBtnText, { color: theme.chipGreenText }]}>Mark Answered</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.prayerBtn, { backgroundColor: theme.surfaceAlt }]}
                    onPress={() => sharePrayer(p)}
                  >
                    <Text style={[styles.prayerBtnText, { color: theme.textSub }]}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.prayerBtn, { backgroundColor: theme.chipRedBg }]}
                    onPress={() => deletePrayer(p.id)}
                  >
                    <Text style={[styles.prayerBtnText, { color: theme.chipRedText }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── PLANS TAB ── */}
        {activeTab === 'plans' && (
          <View style={styles.section}>
            <SectionHeader title="Reading plans" />
            {READING_PLANS.map((plan) => {
              const isActive = activePlan?.id === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    { backgroundColor: isActive ? theme.accentSoft : theme.surface, borderColor: isActive ? theme.accent : theme.border },
                  ]}
                  onPress={() => selectPlan(plan)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.planEmoji}>{plan.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.planTitle, { color: theme.text }]}>{plan.title}</Text>
                    <Text style={[styles.planDesc, { color: theme.textSub }]}>{plan.description}</Text>
                    <Text style={[styles.planDays, { color: theme.textMuted }]}>{plan.totalDays} days</Text>
                  </View>
                  {isActive && <Chip label="Active" variant="green" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── PASSAGE READER MODAL ── */}
      <Modal visible={passageModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.passageModal, { backgroundColor: theme.background }]}>
          <View style={styles.passageHeader}>
            <Text style={[styles.passageTitle, { color: theme.text }]}>{selectedPassage}</Text>
            <TouchableOpacity onPress={() => setPassageModalVisible(false)}>
              <Text style={[styles.passageClose, { color: theme.accent }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.passageScroll} showsVerticalScrollIndicator={false}>
            {passageLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginTop: 40 }} />
            ) : (
              <Text style={[styles.passageText, { color: theme.text }]}>{passageText}</Text>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── ADD PRAYER MODAL ── */}
      <Modal visible={prayerModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setPrayerModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>New prayer request</Text>

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>REQUEST</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. Healing for my father"
              placeholderTextColor={theme.textMuted}
              value={newPrayer.title}
              onChangeText={v => setNewPrayer(p => ({ ...p, title: v }))}
            />

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>DETAILS (OPTIONAL)</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="Add any details..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={newPrayer.details}
              onChangeText={v => setNewPrayer(p => ({ ...p, details: v }))}
            />

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>CATEGORY</Text>
            <View style={styles.catGrid}>
              {(Object.keys(CATEGORY_LABELS) as PrayerCategory[]).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, { borderColor: theme.border, backgroundColor: newPrayer.category === cat ? theme.accent : theme.surfaceAlt }]}
                  onPress={() => setNewPrayer(p => ({ ...p, category: cat }))}
                >
                  <Text style={[styles.catChipText, { color: newPrayer.category === cat ? '#fff' : theme.textSub }]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={savePrayer}>
              <Text style={styles.saveBtnText}>Save prayer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setPrayerModalVisible(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MARK ANSWERED MODAL ── */}
      <Modal visible={!!answerModalId} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAnswerModalId(null)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>🎉 Prayer Answered!</Text>
            <Text style={[styles.modalSub, { color: theme.textSub }]}>How did God answer this prayer?</Text>

            <TextInput
              style={[styles.textArea, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text, marginTop: 16 }]}
              placeholder="Describe how God answered..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={answerNotes}
              onChangeText={setAnswerNotes}
            />

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: theme.sage }]}
              onPress={() => answerModalId && markAnswered(answerModalId)}
            >
              <Text style={styles.saveBtnText}>Mark as Answered</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAnswerModalId(null)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 18 },
  pageTitle: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  pageSub: { fontSize: 12, marginTop: 2 },
  subTabs: { flexDirection: 'row', borderRadius: 12, padding: 3, marginHorizontal: 16, marginTop: 12 },
  subTab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  subTabText: { fontSize: 11, fontWeight: '600' },
  verseCard: { borderRadius: 16, marginHorizontal: 16, marginTop: 14, padding: 16, borderWidth: 1 },
  verseLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  verseText: { fontSize: 16, lineHeight: 28, fontStyle: 'italic' },
  verseRef: { fontSize: 11, fontWeight: '600', marginTop: 8 },
  progressSection: { paddingHorizontal: 16, marginTop: 14 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { fontSize: 12 },
  progressPct: { fontSize: 12, fontWeight: '600' },
  progressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressSub: { fontSize: 11, marginTop: 5 },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  readingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  readingPassage: { fontSize: 15, fontWeight: '500' },
  readingSub: { fontSize: 11, marginTop: 2 },
  noPlanCard: { marginHorizontal: 16, marginTop: 20, borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1 },
  noPlanEmoji: { fontSize: 40, marginBottom: 12 },
  noPlanTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  noPlanSub: { fontSize: 14 },
  // Prayer
  filterRow: { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 14 },
  filterBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  filterBtnText: { fontSize: 12, fontWeight: '600' },
  prayerCard: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  prayerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  prayerDate: { fontSize: 11 },
  prayerTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  prayerDetails: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  answerNote: { borderRadius: 8, padding: 8, marginBottom: 8 },
  answerNoteText: { fontSize: 12, lineHeight: 18 },
  prayerActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  prayerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  prayerBtnText: { fontSize: 11, fontWeight: '600' },
  emptyState: { borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  // Plans
  planCard: { borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  planEmoji: { fontSize: 28, width: 40, textAlign: 'center' },
  planTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  planDesc: { fontSize: 12, lineHeight: 18, marginBottom: 2 },
  planDays: { fontSize: 11 },
  // Passage modal
  passageModal: { flex: 1, paddingTop: 8 },
  passageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  passageTitle: { fontSize: 17, fontWeight: '600' },
  passageClose: { fontSize: 15, fontWeight: '600' },
  passageScroll: { flex: 1, paddingHorizontal: 20 },
  passageText: { fontSize: 16, lineHeight: 30, paddingTop: 20 },
  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { fontSize: 14, lineHeight: 20 },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textArea: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 90, lineHeight: 22 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: 12, fontWeight: '500' },
  saveBtn: { padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { fontSize: 13 },
});
