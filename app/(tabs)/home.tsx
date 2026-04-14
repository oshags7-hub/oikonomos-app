import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';
import { AIInsightCard } from '@/components/AIInsightCard';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { SectionHeader } from '@/components/SectionHeader';
import { supabase } from '@/lib/supabase';
import { getInsight } from '@/lib/anthropic';

type Task = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  status: 'due' | 'upcoming' | 'done' | 'open';
  category: 'maintenance' | 'repair';
  due_date?: string;
};

const ICON_OPTIONS = ['🔧', '🌬️', '🌧️', '🌱', '🚗', '🏠', '💧', '⚡', '🪟', '🛁', '🔨', '🪣'];

export default function HomeScreen() {
  const { profile, theme } = useProfile();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [insight, setInsight] = useState('Keep up with regular maintenance to avoid costly repairs. Small tasks now save big money later.');
  const [insightLoading, setInsightLoading] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', icon: '🔧', category: 'maintenance' as 'maintenance' | 'repair', due_date: '' });

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('home_tasks')
      .select('*')
      .eq('user_profile', profile)
      .order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
  }, [profile]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setInsightLoading(true);
      try {
        const dueSoon = tasks.filter(t => t.status === 'due' || t.status === 'open').length;
        const text = await getInsight({
          screen: 'home',
          data: { tasks_due: dueSoon, repairs_open: tasks.filter(t => t.status === 'open').length, season: 'spring' },
        });
        if (!cancelled) setInsight(text);
      } catch { /* keep default */ }
      finally { if (!cancelled) setInsightLoading(false); }
    }
    if (tasks.length > 0) load();
    return () => { cancelled = true; };
  }, [tasks.length]);

  async function saveTask() {
    if (!newTask.title.trim()) return;
    const { error } = await supabase.from('home_tasks').insert({
      user_profile: profile,
      icon: newTask.icon,
      title: newTask.title,
      subtitle: newTask.due_date ? `Due ${newTask.due_date}` : 'Just added',
      status: newTask.category === 'repair' ? 'open' : 'upcoming',
      category: newTask.category,
      due_date: newTask.due_date || null,
    });
    if (!error) {
      setNewTask({ title: '', icon: '🔧', category: 'maintenance', due_date: '' });
      setModalVisible(false);
      loadTasks();
    }
  }

  async function cycleStatus(task: Task) {
    const next: Task['status'] =
      task.status === 'upcoming' ? 'due' :
      task.status === 'due' ? 'done' :
      task.status === 'open' ? 'done' :
      'upcoming';
    await supabase.from('home_tasks').update({ status: next }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
  }

  async function deleteTask(id: string) {
    await supabase.from('home_tasks').delete().eq('id', id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  const maintenance = tasks.filter(t => t.category === 'maintenance');
  const repairs = tasks.filter(t => t.category === 'repair');
  const dueSoon = tasks.filter(t => t.status === 'due').length;
  const openRepairs = tasks.filter(t => t.status === 'open').length;

  const chipVariant = (status: Task['status']) => {
    if (status === 'done') return 'green';
    if (status === 'open') return 'amber';
    if (status === 'due') return 'red';
    return 'neutral';
  };

  const chipLabel = (t: Task) => {
    if (t.status === 'done') return 'Done ✓';
    if (t.status === 'open') return 'Open';
    if (t.status === 'due') return t.due_date ?? 'Due';
    return t.due_date ? `Due ${t.due_date}` : 'Upcoming';
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={[styles.pageTitle, { color: theme.text }]}>Home</Text>
            <Text style={[styles.pageSub, { color: theme.textSub }]}>Maintenance & repairs</Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.accent }]}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        {tasks.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.stat, { backgroundColor: theme.heroBackground }]}>
              <Text style={[styles.statLabel, { color: theme.heroSub }]}>DUE SOON</Text>
              <Text style={[styles.statVal, { color: dueSoon > 0 ? '#E53935' : theme.heroText }]}>{dueSoon}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: theme.heroBackground }]}>
              <Text style={[styles.statLabel, { color: theme.heroSub }]}>OPEN REPAIRS</Text>
              <Text style={[styles.statVal, { color: openRepairs > 0 ? '#E08060' : theme.heroText }]}>{openRepairs}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: theme.heroBackground }]}>
              <Text style={[styles.statLabel, { color: theme.heroSub }]}>TOTAL TASKS</Text>
              <Text style={[styles.statVal, { color: theme.heroText }]}>{tasks.length}</Text>
            </View>
          </View>
        )}

        {/* Maintenance */}
        <View style={styles.section}>
          <SectionHeader title="Maintenance" action="+ Add" onAction={() => { setNewTask(p => ({ ...p, category: 'maintenance' })); setModalVisible(true); }} />
          {maintenance.length === 0 ? (
            <TouchableOpacity
              style={[styles.emptyCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              onPress={() => { setNewTask(p => ({ ...p, category: 'maintenance' })); setModalVisible(true); }}
            >
              <Text style={[styles.emptyCardText, { color: theme.textSub }]}>+ Add maintenance task</Text>
            </TouchableOpacity>
          ) : (
            <Card noPad>
              {maintenance.map((t, i) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.taskRow, { borderBottomColor: theme.borderLight }, i === maintenance.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => cycleStatus(t)}
                  onLongPress={() => deleteTask(t.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.taskIcon, { backgroundColor: theme.accentSoft }]}>
                    <Text style={{ fontSize: 16 }}>{t.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, { color: theme.text, textDecorationLine: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.5 : 1 }]}>
                      {t.title}
                    </Text>
                    <Text style={[styles.taskSub, { color: theme.textSub }]}>{t.subtitle}</Text>
                  </View>
                  <Chip label={chipLabel(t)} variant={chipVariant(t.status)} />
                </TouchableOpacity>
              ))}
            </Card>
          )}
          {maintenance.length > 0 && (
            <Text style={[styles.hint, { color: theme.textMuted }]}>Tap to cycle status · Long-press to delete</Text>
          )}
        </View>

        {/* Repairs */}
        <View style={styles.section}>
          <SectionHeader title="Repairs" action="+ Log" onAction={() => { setNewTask(p => ({ ...p, category: 'repair' })); setModalVisible(true); }} />
          {repairs.length === 0 ? (
            <TouchableOpacity
              style={[styles.emptyCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              onPress={() => { setNewTask(p => ({ ...p, category: 'repair' })); setModalVisible(true); }}
            >
              <Text style={[styles.emptyCardText, { color: theme.textSub }]}>+ Log a repair issue</Text>
            </TouchableOpacity>
          ) : (
            <Card noPad>
              {repairs.map((t, i) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.taskRow, { borderBottomColor: theme.borderLight }, i === repairs.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => cycleStatus(t)}
                  onLongPress={() => deleteTask(t.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.taskIcon, { backgroundColor: t.status === 'done' ? '#7A906820' : '#C07B5A20' }]}>
                    <Text style={{ fontSize: 16 }}>{t.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.taskTitle, { color: theme.text, textDecorationLine: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.5 : 1 }]}>
                      {t.title}
                    </Text>
                    <Text style={[styles.taskSub, { color: theme.textSub }]}>{t.subtitle}</Text>
                  </View>
                  <Chip label={chipLabel(t)} variant={chipVariant(t.status)} />
                </TouchableOpacity>
              ))}
            </Card>
          )}
          {repairs.length > 0 && (
            <Text style={[styles.hint, { color: theme.textMuted }]}>Tap to mark done · Long-press to delete</Text>
          )}
        </View>

        {tasks.length === 0 && (
          <View style={[styles.bigEmpty, { marginHorizontal: 16 }]}>
            <Text style={styles.bigEmptyEmoji}>🏠</Text>
            <Text style={[styles.bigEmptyTitle, { color: theme.text }]}>No tasks yet</Text>
            <Text style={[styles.bigEmptySub, { color: theme.textSub }]}>Track home maintenance schedules and log repairs to stay on top of your home</Text>
            <TouchableOpacity style={[styles.bigEmptyBtn, { backgroundColor: theme.accent }]} onPress={() => setModalVisible(true)}>
              <Text style={styles.bigEmptyBtnText}>Add first task</Text>
            </TouchableOpacity>
          </View>
        )}

        <AIInsightCard text={insight} loading={insightLoading} />
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── ADD TASK MODAL ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setModalVisible(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add task</Text>

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {ICON_OPTIONS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconPick, { backgroundColor: newTask.icon === icon ? theme.accent : theme.surfaceAlt }]}
                    onPress={() => setNewTask(p => ({ ...p, icon }))}
                  >
                    <Text style={{ fontSize: 20 }}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>TASK NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. Replace water filter"
              placeholderTextColor={theme.textMuted}
              value={newTask.title}
              onChangeText={v => setNewTask(p => ({ ...p, title: v }))}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>DUE DATE (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. May 15"
              placeholderTextColor={theme.textMuted}
              value={newTask.due_date}
              onChangeText={v => setNewTask(p => ({ ...p, due_date: v }))}
            />

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>CATEGORY</Text>
            <View style={styles.catRow}>
              {(['maintenance', 'repair'] as const).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catBtn, { borderColor: theme.border }, newTask.category === c && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                  onPress={() => setNewTask(p => ({ ...p, category: c }))}
                >
                  <Text style={[styles.catBtnText, { color: newTask.category === c ? '#fff' : theme.textSub }]}>
                    {c === 'maintenance' ? '🔧 Maintenance' : '🔨 Repair'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={saveTask}>
              <Text style={styles.saveBtnText}>Save task</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
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
  pageTitle: { fontSize: 32, fontWeight: '600', letterSpacing: -0.5 },
  pageSub: { fontSize: 12, marginTop: 2 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginTop: 6 },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  stat: { flex: 1, borderRadius: 14, padding: 10 },
  statLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
  statVal: { fontSize: 20, fontWeight: '700', marginTop: 3 },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1 },
  taskIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  taskTitle: { fontSize: 14, fontWeight: '500' },
  taskSub: { fontSize: 11, marginTop: 1 },
  hint: { fontSize: 11, textAlign: 'center', marginTop: 6 },
  emptyCard: { borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' },
  emptyCardText: { fontSize: 14, fontWeight: '500' },
  bigEmpty: { borderRadius: 20, padding: 32, alignItems: 'center', marginTop: 16 },
  bigEmptyEmoji: { fontSize: 44, marginBottom: 12 },
  bigEmptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  bigEmptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  bigEmptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  bigEmptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  iconPick: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  catRow: { flexDirection: 'row', gap: 10 },
  catBtn: { flex: 1, padding: 11, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  catBtnText: { fontSize: 13, fontWeight: '600' },
  saveBtn: { padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { fontSize: 13 },
});
