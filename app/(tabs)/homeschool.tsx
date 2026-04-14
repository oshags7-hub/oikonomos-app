import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { SectionHeader } from '@/components/SectionHeader';
import { AIInsightCard } from '@/components/AIInsightCard';
import { supabase } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

type SubTab = 'today' | 'planner' | 'children';

type Child = { id: string; name: string; grade_level?: string };
type Subject = { id: string; child_id: string; name: string; curriculum?: string; color: string };
type LessonPlan = {
  id: string;
  child_id: string;
  subject_id?: string;
  title: string;
  description?: string;
  date: string;
  duration?: number;
  completed: boolean;
};

const DEFAULT_SUBJECTS = ['Bible', 'Math', 'Reading', 'Writing', 'Science', 'History', 'Art', 'PE'];
const SUBJECT_COLORS = ['#C07B5A', '#7A9068', '#7B5EA7', '#4E9BF5', '#E08060', '#3D6B35', '#8B3030', '#2A5E8B'];
const GRADES = ['Pre-K', 'K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const WEEK_DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getWeekDates(): string[] {
  const today = new Date();
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

export default function HomeschoolScreen() {
  const { profile, theme } = useProfile();

  const [activeTab, setActiveTab] = useState<SubTab>('today');
  const [children, setChildren] = useState<Child[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [lessons, setLessons] = useState<LessonPlan[]>([]);
  const [weekLessons, setWeekLessons] = useState<LessonPlan[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [plannerDayIdx, setPlannerDayIdx] = useState(0);

  const [addChildModal, setAddChildModal] = useState(false);
  const [addLessonModal, setAddLessonModal] = useState(false);
  const [addPlannerLessonModal, setAddPlannerLessonModal] = useState(false);
  const [aiIdeaModal, setAiIdeaModal] = useState(false);
  const [newChild, setNewChild] = useState({ name: '', grade_level: '' });
  const [newLesson, setNewLesson] = useState({ title: '', description: '', subject_id: '', duration: '' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const weekDates = getWeekDates();

  const loadChildren = useCallback(async () => {
    const { data } = await supabase.from('homeschool_children').select('*').eq('user_profile', profile).order('created_at');
    if (data) {
      setChildren(data as Child[]);
      if (!selectedChild && data.length > 0) setSelectedChild(data[0] as Child);
    }
  }, [profile]);

  const loadSubjects = useCallback(async () => {
    if (!selectedChild) return;
    const { data } = await supabase.from('homeschool_subjects').select('*').eq('child_id', selectedChild.id);
    if (data) setSubjects(data as Subject[]);
  }, [selectedChild]);

  const loadLessons = useCallback(async () => {
    if (!selectedChild) return;
    const { data } = await supabase
      .from('lesson_plans').select('*')
      .eq('child_id', selectedChild.id).eq('date', today).order('created_at');
    if (data) setLessons(data as LessonPlan[]);
  }, [selectedChild, today]);

  const loadWeekLessons = useCallback(async () => {
    if (!selectedChild || weekDates.length === 0) return;
    const { data } = await supabase
      .from('lesson_plans').select('*')
      .eq('child_id', selectedChild.id)
      .in('date', weekDates)
      .order('created_at');
    if (data) setWeekLessons(data as LessonPlan[]);
  }, [selectedChild, weekDates.join(',')]);

  useEffect(() => { loadChildren(); }, [loadChildren]);
  useEffect(() => { loadSubjects(); loadLessons(); loadWeekLessons(); }, [loadSubjects, loadLessons, loadWeekLessons]);

  async function addChild() {
    if (!newChild.name.trim()) return;
    const { data } = await supabase.from('homeschool_children').insert({
      user_profile: profile,
      name: newChild.name,
      grade_level: newChild.grade_level || null,
    }).select().single();
    if (data) {
      for (let i = 0; i < DEFAULT_SUBJECTS.length; i++) {
        await supabase.from('homeschool_subjects').insert({
          child_id: data.id,
          name: DEFAULT_SUBJECTS[i],
          color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
        });
      }
    }
    setNewChild({ name: '', grade_level: '' });
    setAddChildModal(false);
    loadChildren();
  }

  async function addLesson(forDate: string = today, closeModal: () => void) {
    if (!newLesson.title.trim() || !selectedChild) return;
    await supabase.from('lesson_plans').insert({
      child_id: selectedChild.id,
      subject_id: newLesson.subject_id || null,
      title: newLesson.title,
      description: newLesson.description || null,
      date: forDate,
      duration: newLesson.duration ? parseInt(newLesson.duration) : null,
      completed: false,
    });
    setNewLesson({ title: '', description: '', subject_id: '', duration: '' });
    closeModal();
    loadLessons();
    loadWeekLessons();
  }

  async function toggleLesson(id: string, done: boolean) {
    await supabase.from('lesson_plans').update({ completed: !done }).eq('id', id);
    setLessons(prev => prev.map(l => l.id === id ? { ...l, completed: !done } : l));
    setWeekLessons(prev => prev.map(l => l.id === id ? { ...l, completed: !done } : l));
  }

  async function generateWeekPlan() {
    if (!selectedChild) return;
    setAiLoading(true);
    try {
      const client = new Anthropic({ apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
      const subjectNames = subjects.map(s => s.name).join(', ');
      const grade = selectedChild.grade_level ?? 'elementary';
      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Create a simple 5-day homeschool lesson plan for a ${grade} student.
Subjects available: ${subjectNames || 'Bible, Math, Reading, Writing, Science, History'}.
Return ONLY JSON like this:
{
  "monday":    [{"title":"Bible - Genesis 1-2","subject":"Bible","duration":20},{"title":"Math - Addition facts","subject":"Math","duration":30}],
  "tuesday":   [...],
  "wednesday": [...],
  "thursday":  [...],
  "friday":    [...]
}
Keep lesson titles short and practical. 3-4 lessons per day. Faith-integrated where natural.`,
        }],
      });
      const content = res.content[0];
      if (content.type === 'text') {
        const match = content.text.match(/\{[\s\S]*\}/);
        if (match) {
          const plan: Record<string, Array<{ title: string; subject: string; duration: number }>> = JSON.parse(match[0]);
          const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
          for (let i = 0; i < dayKeys.length; i++) {
            const dayLessons = plan[dayKeys[i]] ?? [];
            for (const lesson of dayLessons) {
              const subject = subjects.find(s => s.name.toLowerCase() === lesson.subject.toLowerCase());
              await supabase.from('lesson_plans').insert({
                child_id: selectedChild.id,
                subject_id: subject?.id ?? null,
                title: lesson.title,
                date: weekDates[i],
                duration: lesson.duration ?? null,
                completed: false,
              });
            }
          }
          loadWeekLessons();
          Alert.alert('Week planned!', 'AI has added lessons for Mon–Fri.');
        }
      }
    } catch {
      Alert.alert('Error', 'Could not generate week plan. Check your internet connection.');
    } finally {
      setAiLoading(false);
    }
  }

  async function generateAiIdea() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const client = new Anthropic({ apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
      const grade = selectedChild?.grade_level ?? 'elementary';
      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `You are a creative Christian homeschool curriculum advisor.
Grade level: ${grade}
Request: ${aiPrompt}

Provide 3 specific, practical, faith-integrated lesson ideas. Each should include:
- A clear activity title
- A brief description (2-3 sentences)
- A Bible connection

Format as numbered list. Be warm, encouraging, and practical.`,
        }],
      });
      const content = res.content[0];
      if (content.type === 'text') setAiResult(content.text);
    } catch {
      setAiResult('Could not generate ideas. Check your API key and internet connection.');
    } finally {
      setAiLoading(false);
    }
  }

  const completedToday = lessons.filter(l => l.completed).length;
  const totalToday = lessons.length;
  const progressPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const getSubjectColor = (subjectId?: string) => subjects.find(s => s.id === subjectId)?.color ?? theme.accent;
  const getSubjectName = (subjectId?: string) => subjects.find(s => s.id === subjectId)?.name ?? '';

  const plannerDateLessons = weekLessons.filter(l => l.date === weekDates[plannerDayIdx]);
  const plannerDoneCount = plannerDateLessons.filter(l => l.completed).length;

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'planner', label: 'Planner' },
    { key: 'children', label: 'Children' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Homeschool</Text>
          <Text style={[styles.pageSub, { color: theme.textSub }]}>
            {selectedChild ? `${selectedChild.name} · ${selectedChild.grade_level ?? 'No grade'}` : 'Add a child to get started'}
          </Text>
        </View>
        <TouchableOpacity style={[styles.aiBtn, { backgroundColor: theme.accentSoft }]} onPress={() => setAiIdeaModal(true)}>
          <Text style={[styles.aiBtnText, { color: theme.accent }]}>✦ AI Ideas</Text>
        </TouchableOpacity>
      </View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {children.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.childChip, { backgroundColor: selectedChild?.id === c.id ? theme.accent : theme.surfaceAlt, borderColor: theme.border }]}
              onPress={() => setSelectedChild(c)}
            >
              <Text style={[styles.childChipText, { color: selectedChild?.id === c.id ? '#fff' : theme.text }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={[styles.subTabs, { backgroundColor: theme.surfaceAlt }]}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.subTab, activeTab === t.key && { backgroundColor: theme.surface }]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.subTabText, { color: activeTab === t.key ? theme.text : theme.textSub }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── TODAY TAB ── */}
        {activeTab === 'today' && (
          <>
            {children.length === 0 ? (
              <View style={[styles.emptyState, { marginHorizontal: 16, marginTop: 32 }]}>
                <Text style={styles.emptyEmoji}>✏️</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No children yet</Text>
                <Text style={[styles.emptySub, { color: theme.textSub }]}>Add a child to start planning your homeschool days</Text>
                <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setAddChildModal(true)}>
                  <Text style={styles.emptyBtnText}>Add first child</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {totalToday > 0 && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressRow}>
                      <Text style={[styles.progressLabel, { color: theme.textSub }]}>Today's progress</Text>
                      <Text style={[styles.progressPct, { color: theme.text }]}>{completedToday}/{totalToday} done</Text>
                    </View>
                    <View style={[styles.progressBg, { backgroundColor: theme.progressBg }]}>
                      <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: theme.sage }]} />
                    </View>
                    {progressPct === 100 && (
                      <Text style={[styles.progressSub, { color: theme.sage }]}>🎉 All done for today! Great work!</Text>
                    )}
                  </View>
                )}

                <View style={styles.section}>
                  <SectionHeader
                    title={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    action="+ Add lesson"
                    onAction={() => setAddLessonModal(true)}
                  />
                  {lessons.length === 0 ? (
                    <TouchableOpacity
                      style={[styles.addLessonPlaceholder, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                      onPress={() => setAddLessonModal(true)}
                    >
                      <Text style={[styles.addLessonText, { color: theme.textSub }]}>+ Tap to add today's lessons</Text>
                    </TouchableOpacity>
                  ) : (
                    <Card noPad>
                      {lessons.map((lesson, i) => (
                        <TouchableOpacity
                          key={lesson.id}
                          style={[styles.lessonRow, { borderBottomColor: theme.borderLight }, i === lessons.length - 1 && { borderBottomWidth: 0 }]}
                          onPress={() => toggleLesson(lesson.id, lesson.completed)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.lessonColorBar, { backgroundColor: getSubjectColor(lesson.subject_id) }]} />
                          <View style={[styles.check, { borderColor: lesson.completed ? 'transparent' : theme.border, backgroundColor: lesson.completed ? theme.sage : 'transparent' }]}>
                            {lesson.completed && <Text style={styles.checkMark}>✓</Text>}
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.lessonTitle, { color: theme.text, opacity: lesson.completed ? 0.45 : 1, textDecorationLine: lesson.completed ? 'line-through' : 'none' }]}>
                              {lesson.title}
                            </Text>
                            {(lesson.subject_id || lesson.duration) && (
                              <Text style={[styles.lessonMeta, { color: theme.textSub }]}>
                                {[getSubjectName(lesson.subject_id), lesson.duration ? `${lesson.duration} min` : null].filter(Boolean).join(' · ')}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </Card>
                  )}
                </View>

                {subjects.length > 0 && (
                  <View style={styles.section}>
                    <SectionHeader title="Subjects" />
                    <View style={styles.subjectsGrid}>
                      {subjects.map(s => (
                        <View key={s.id} style={[styles.subjectPill, { backgroundColor: s.color + '18', borderColor: s.color + '40' }]}>
                          <View style={[styles.subjectDot, { backgroundColor: s.color }]} />
                          <Text style={[styles.subjectName, { color: theme.text }]}>{s.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <AIInsightCard text="Consistent short lessons (20-30 min) with movement breaks outperform long sessions. Start with Bible, then tackle the hardest subject while minds are fresh." />
              </>
            )}
          </>
        )}

        {/* ── PLANNER TAB ── */}
        {activeTab === 'planner' && (
          <>
            {children.length === 0 ? (
              <View style={[styles.emptyState, { marginHorizontal: 16, marginTop: 32 }]}>
                <Text style={styles.emptyEmoji}>📅</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Add a child first</Text>
                <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => { setActiveTab('children'); setAddChildModal(true); }}>
                  <Text style={styles.emptyBtnText}>Add child</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Week header with AI plan button */}
                <View style={[styles.plannerTop, { paddingHorizontal: 16, marginTop: 14 }]}>
                  <Text style={[styles.weekLabel, { color: theme.text }]}>This Week</Text>
                  <TouchableOpacity
                    style={[styles.aiPlanBtn, { backgroundColor: theme.accent, opacity: aiLoading ? 0.7 : 1 }]}
                    onPress={generateWeekPlan}
                    disabled={aiLoading}
                  >
                    <Text style={styles.aiPlanBtnText}>{aiLoading ? '✨ Planning...' : '✨ AI Plan Week'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Day selector */}
                <View style={[styles.daySelector, { backgroundColor: theme.surfaceAlt }]}>
                  {WEEK_DAYS.map((day, i) => {
                    const dayLessons = weekLessons.filter(l => l.date === weekDates[i]);
                    const done = dayLessons.filter(l => l.completed).length;
                    const isToday = weekDates[i] === today;
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[styles.dayBtn, plannerDayIdx === i && { backgroundColor: theme.surface }]}
                        onPress={() => setPlannerDayIdx(i)}
                      >
                        <Text style={[styles.dayBtnLabel, { color: plannerDayIdx === i ? theme.accent : theme.textSub }]}>{day}</Text>
                        {isToday && <View style={[styles.todayDot, { backgroundColor: theme.accent }]} />}
                        {dayLessons.length > 0 && (
                          <Text style={[styles.dayBtnCount, { color: done === dayLessons.length ? theme.sage : theme.textMuted }]}>
                            {done}/{dayLessons.length}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Selected day lessons */}
                <View style={styles.section}>
                  <SectionHeader
                    title={`${WEEK_DAY_FULL[plannerDayIdx]} · ${plannerDateLessons.length} lessons${plannerDoneCount > 0 ? ` · ${plannerDoneCount} done` : ''}`}
                    action="+ Add"
                    onAction={() => setAddPlannerLessonModal(true)}
                  />

                  {plannerDateLessons.length === 0 ? (
                    <TouchableOpacity
                      style={[styles.addLessonPlaceholder, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                      onPress={() => setAddPlannerLessonModal(true)}
                    >
                      <Text style={[styles.addLessonText, { color: theme.textSub }]}>+ Add lessons for {WEEK_DAYS[plannerDayIdx]}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Card noPad>
                      {plannerDateLessons.map((lesson, i) => (
                        <TouchableOpacity
                          key={lesson.id}
                          style={[styles.lessonRow, { borderBottomColor: theme.borderLight }, i === plannerDateLessons.length - 1 && { borderBottomWidth: 0 }]}
                          onPress={() => toggleLesson(lesson.id, lesson.completed)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.lessonColorBar, { backgroundColor: getSubjectColor(lesson.subject_id) }]} />
                          <View style={[styles.check, { borderColor: lesson.completed ? 'transparent' : theme.border, backgroundColor: lesson.completed ? theme.sage : 'transparent' }]}>
                            {lesson.completed && <Text style={styles.checkMark}>✓</Text>}
                          </View>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.lessonTitle, { color: theme.text, opacity: lesson.completed ? 0.45 : 1, textDecorationLine: lesson.completed ? 'line-through' : 'none' }]}>
                              {lesson.title}
                            </Text>
                            {(lesson.subject_id || lesson.duration) && (
                              <Text style={[styles.lessonMeta, { color: theme.textSub }]}>
                                {[getSubjectName(lesson.subject_id), lesson.duration ? `${lesson.duration} min` : null].filter(Boolean).join(' · ')}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                    </Card>
                  )}
                </View>

                {/* Week overview mini grid */}
                <View style={styles.section}>
                  <SectionHeader title="Week at a glance" />
                  <View style={styles.weekGrid}>
                    {WEEK_DAYS.map((day, i) => {
                      const dayLessons = weekLessons.filter(l => l.date === weekDates[i]);
                      const done = dayLessons.filter(l => l.completed).length;
                      const pct = dayLessons.length > 0 ? Math.round((done / dayLessons.length) * 100) : 0;
                      return (
                        <TouchableOpacity
                          key={day}
                          style={[styles.weekGridCell, { backgroundColor: theme.surface, borderColor: plannerDayIdx === i ? theme.accent : theme.border }]}
                          onPress={() => setPlannerDayIdx(i)}
                        >
                          <Text style={[styles.weekGridDay, { color: plannerDayIdx === i ? theme.accent : theme.textSub }]}>{day}</Text>
                          <Text style={[styles.weekGridNum, { color: theme.text }]}>{dayLessons.length}</Text>
                          <View style={[styles.weekGridBar, { backgroundColor: theme.progressBg }]}>
                            <View style={[styles.weekGridFill, { width: `${pct}%`, backgroundColor: pct === 100 ? theme.sage : theme.accent }]} />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
          </>
        )}

        {/* ── CHILDREN TAB ── */}
        {activeTab === 'children' && (
          <View style={styles.section}>
            <SectionHeader title="Children" action="+ Add child" onAction={() => setAddChildModal(true)} />
            {children.length === 0 ? (
              <View style={[styles.emptyState, { marginTop: 12 }]}>
                <Text style={styles.emptyEmoji}>👧</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No children yet</Text>
                <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setAddChildModal(true)}>
                  <Text style={styles.emptyBtnText}>Add first child</Text>
                </TouchableOpacity>
              </View>
            ) : (
              children.map(child => (
                <View key={child.id} style={[styles.childCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.childAvatar, { backgroundColor: theme.accentSoft }]}>
                    <Text style={[styles.childAvatarText, { color: theme.accent }]}>{child.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.childName, { color: theme.text }]}>{child.name}</Text>
                    <Text style={[styles.childGrade, { color: theme.textSub }]}>{child.grade_level ? `Grade: ${child.grade_level}` : 'No grade set'}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedChild(child)}>
                    <Chip label={selectedChild?.id === child.id ? 'Active' : 'Switch'} variant={selectedChild?.id === child.id ? 'green' : 'neutral'} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── ADD CHILD MODAL ── */}
      <Modal visible={addChildModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddChildModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add child</Text>
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. Emma"
              placeholderTextColor={theme.textMuted}
              value={newChild.name}
              onChangeText={v => setNewChild(p => ({ ...p, name: v }))}
              autoFocus
            />
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>GRADE LEVEL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {GRADES.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gradeChip, { backgroundColor: newChild.grade_level === g ? theme.accent : theme.surfaceAlt, borderColor: theme.border }]}
                    onPress={() => setNewChild(p => ({ ...p, grade_level: g }))}
                  >
                    <Text style={[styles.gradeChipText, { color: newChild.grade_level === g ? '#fff' : theme.textSub }]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={addChild}>
              <Text style={styles.saveBtnText}>Add child</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddChildModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ADD LESSON MODAL (today) ── */}
      <Modal visible={addLessonModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddLessonModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add lesson — Today</Text>
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>LESSON TITLE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. Multiplication tables 6–9"
              placeholderTextColor={theme.textMuted}
              value={newLesson.title}
              onChangeText={v => setNewLesson(p => ({ ...p, title: v }))}
              autoFocus
            />
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>SUBJECT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {subjects.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.gradeChip, { backgroundColor: newLesson.subject_id === s.id ? s.color : theme.surfaceAlt, borderColor: theme.border }]}
                    onPress={() => setNewLesson(p => ({ ...p, subject_id: s.id }))}
                  >
                    <Text style={[styles.gradeChipText, { color: newLesson.subject_id === s.id ? '#fff' : theme.textSub }]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>DURATION (MIN)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="30"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              value={newLesson.duration}
              onChangeText={v => setNewLesson(p => ({ ...p, duration: v }))}
            />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={() => addLesson(today, () => setAddLessonModal(false))}>
              <Text style={styles.saveBtnText}>Add lesson</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddLessonModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ADD PLANNER LESSON MODAL ── */}
      <Modal visible={addPlannerLessonModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddPlannerLessonModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add lesson — {WEEK_DAY_FULL[plannerDayIdx]}</Text>
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>LESSON TITLE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. Reading — Charlotte's Web ch. 3"
              placeholderTextColor={theme.textMuted}
              value={newLesson.title}
              onChangeText={v => setNewLesson(p => ({ ...p, title: v }))}
              autoFocus
            />
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>SUBJECT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {subjects.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.gradeChip, { backgroundColor: newLesson.subject_id === s.id ? s.color : theme.surfaceAlt, borderColor: theme.border }]}
                    onPress={() => setNewLesson(p => ({ ...p, subject_id: s.id }))}
                  >
                    <Text style={[styles.gradeChipText, { color: newLesson.subject_id === s.id ? '#fff' : theme.textSub }]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={[styles.inputLabel, { color: theme.textSub }]}>DURATION (MIN)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="30"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              value={newLesson.duration}
              onChangeText={v => setNewLesson(p => ({ ...p, duration: v }))}
            />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={() => addLesson(weekDates[plannerDayIdx], () => setAddPlannerLessonModal(false))}>
              <Text style={styles.saveBtnText}>Add to {WEEK_DAYS[plannerDayIdx]}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddPlannerLessonModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── AI IDEAS MODAL ── */}
      <Modal visible={aiIdeaModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.aiModal, { backgroundColor: theme.background }]}>
          <View style={styles.aiModalHeader}>
            <Text style={[styles.aiModalTitle, { color: theme.text }]}>✦ AI Lesson Ideas</Text>
            <TouchableOpacity onPress={() => setAiIdeaModal(false)}>
              <Text style={[styles.aiModalClose, { color: theme.accent }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.aiModalScroll} showsVerticalScrollIndicator={false}>
            <Text style={[styles.aiModalSub, { color: theme.textSub }]}>
              Ask for lesson ideas tailored to {selectedChild?.name ?? 'your child'}{selectedChild?.grade_level ? ` (${selectedChild.grade_level})` : ''}.
            </Text>
            <View style={styles.promptExamples}>
              {[
                '3 fun science activities that connect to creation',
                'How to teach fractions with food',
                'Bible-integrated history lesson ideas for ancient Rome',
                'Active PE games for a rainy day',
              ].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.promptExample, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => setAiPrompt(p)}
                >
                  <Text style={[styles.promptExampleText, { color: theme.text }]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.promptRow}>
              <TextInput
                style={[styles.promptInput, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="Ask for any lesson idea..."
                placeholderTextColor={theme.textMuted}
                value={aiPrompt}
                onChangeText={setAiPrompt}
                multiline
              />
              <TouchableOpacity
                style={[styles.promptSend, { backgroundColor: theme.accent, opacity: aiLoading ? 0.6 : 1 }]}
                onPress={generateAiIdea}
                disabled={aiLoading}
              >
                <Text style={styles.promptSendText}>{aiLoading ? '⏳' : '→'}</Text>
              </TouchableOpacity>
            </View>
            {aiResult ? (
              <View style={[styles.aiResult, { backgroundColor: theme.aiBackground, borderColor: theme.aiBorder }]}>
                <Text style={[styles.aiResultText, { color: theme.text }]}>{aiResult}</Text>
              </View>
            ) : null}
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 18 },
  pageTitle: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  pageSub: { fontSize: 12, marginTop: 2 },
  aiBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginTop: 6 },
  aiBtnText: { fontSize: 13, fontWeight: '600' },
  childScroll: { marginTop: 10 },
  childChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  childChipText: { fontSize: 13, fontWeight: '600' },
  subTabs: { flexDirection: 'row', borderRadius: 12, padding: 3, marginHorizontal: 16, marginTop: 12 },
  subTab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  subTabText: { fontSize: 11, fontWeight: '600' },
  progressSection: { paddingHorizontal: 16, marginTop: 14 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { fontSize: 12 },
  progressPct: { fontSize: 12, fontWeight: '600' },
  progressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressSub: { fontSize: 12, marginTop: 5, fontWeight: '500' },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1 },
  lessonColorBar: { width: 3, height: 36, borderRadius: 2, marginRight: 2, flexShrink: 0 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  lessonTitle: { fontSize: 15, fontWeight: '500' },
  lessonMeta: { fontSize: 11, marginTop: 2 },
  addLessonPlaceholder: { borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' },
  addLessonText: { fontSize: 14, fontWeight: '500' },
  subjectsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subjectPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectName: { fontSize: 12, fontWeight: '500' },
  // Planner
  plannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekLabel: { fontSize: 17, fontWeight: '600' },
  aiPlanBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  aiPlanBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  daySelector: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 4, gap: 2 },
  dayBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  dayBtnLabel: { fontSize: 11, fontWeight: '700' },
  todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  dayBtnCount: { fontSize: 10, marginTop: 2, fontWeight: '600' },
  weekGrid: { flexDirection: 'row', gap: 8 },
  weekGridCell: { flex: 1, borderRadius: 12, padding: 8, borderWidth: 1, alignItems: 'center' },
  weekGridDay: { fontSize: 10, fontWeight: '700' },
  weekGridNum: { fontSize: 18, fontWeight: '700', marginVertical: 2 },
  weekGridBar: { width: '100%', height: 3, borderRadius: 2, overflow: 'hidden' },
  weekGridFill: { height: '100%', borderRadius: 2 },
  // Children tab
  childCard: { borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  childAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  childAvatarText: { fontSize: 20, fontWeight: '700' },
  childName: { fontSize: 16, fontWeight: '600' },
  childGrade: { fontSize: 12, marginTop: 2 },
  emptyState: { borderRadius: 20, padding: 32, alignItems: 'center' },
  emptyEmoji: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  gradeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  gradeChipText: { fontSize: 12, fontWeight: '500' },
  saveBtn: { padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { fontSize: 13 },
  aiModal: { flex: 1 },
  aiModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  aiModalTitle: { fontSize: 17, fontWeight: '700' },
  aiModalClose: { fontSize: 15, fontWeight: '600' },
  aiModalScroll: { flex: 1, paddingHorizontal: 20 },
  aiModalSub: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  promptExamples: { gap: 8, marginBottom: 16 },
  promptExample: { borderRadius: 12, padding: 12, borderWidth: 1 },
  promptExampleText: { fontSize: 13, lineHeight: 20 },
  promptRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  promptInput: { flex: 1, borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 50 },
  promptSend: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  promptSendText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  aiResult: { borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1 },
  aiResultText: { fontSize: 15, lineHeight: 26 },
});
