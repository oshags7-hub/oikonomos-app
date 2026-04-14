import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { AIInsightCard } from '@/components/AIInsightCard';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { SectionHeader } from '@/components/SectionHeader';
import { supabase } from '@/lib/supabase';
import { getInsight } from '@/lib/anthropic';

type SubTab = 'overview' | 'budget' | 'goals';

type Bill = {
  id: string;
  icon: string;
  name: string;
  due_date?: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  recurring: boolean;
};

type BudgetCategory = {
  id: string;
  name: string;
  monthly_limit: number;
  color: string;
  icon: string;
  spent?: number;
};

type SavingsGoal = {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  icon: string;
};

const ICON_OPTIONS = ['💳', '🏠', '⚡', '💧', '📡', '🚗', '📱', '🏥', '🎓', '🛡️', '🔥', '🌐'];
const BILL_STATUSES: Bill['status'][] = ['pending', 'paid', 'overdue'];

export default function FinanceScreen() {
  const { profile, theme } = useProfile();
  const { user } = useAuth();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<SubTab>('overview');
  const [bills, setBills] = useState<Bill[]>([]);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);

  const [addBillModal, setAddBillModal] = useState(false);
  const [addGoalModal, setAddGoalModal] = useState(false);
  const [addBudgetModal, setAddBudgetModal] = useState(false);
  const [plaidModal, setPlaidModal] = useState(false);
  const [newBill, setNewBill] = useState({ name: '', amount: '', due_date: '', icon: '💳', status: 'pending' as Bill['status'], recurring: false });
  const [newGoal, setNewGoal] = useState({ title: '', target_amount: '', current_amount: '', icon: '🎯' });
  const [newBudget, setNewBudget] = useState({ name: '', monthly_limit: '', icon: '💰', color: '#C07B5A' });

  const [insight, setInsight] = useState('Track your bills and budget to stay on top of your household finances.');
  const [insightLoading, setInsightLoading] = useState(false);

  const loadBills = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('bills').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setBills(data as Bill[]);
  }, [userId]);

  const loadBudget = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('budget_categories').select('*').eq('user_id', userId);
    if (data) setBudgetCategories(data as BudgetCategory[]);
  }, [userId]);

  const loadGoals = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at');
    if (data) setSavingsGoals(data as SavingsGoal[]);
  }, [userId]);

  useEffect(() => { loadBills(); loadBudget(); loadGoals(); }, [loadBills, loadBudget, loadGoals]);

  useEffect(() => {
    if (activeTab !== 'overview') return;
    let cancelled = false;
    async function load() {
      setInsightLoading(true);
      try {
        const overdue = bills.filter(b => b.status === 'overdue').length;
        const pending = bills.filter(b => b.status === 'pending').length;
        const text = await getInsight({
          screen: 'finance',
          data: { bills_overdue: overdue, bills_pending: pending, budget_count: budgetCategories.length, goals_count: savingsGoals.length },
        });
        if (!cancelled) setInsight(text);
      } catch { /* keep default */ }
      finally { if (!cancelled) setInsightLoading(false); }
    }
    if (bills.length > 0 || budgetCategories.length > 0) load();
    return () => { cancelled = true; };
  }, [activeTab, bills.length]);

  async function saveBill() {
    if (!userId || !newBill.name.trim()) return;
    await supabase.from('bills').insert({
      user_id: userId,
      icon: newBill.icon,
      name: newBill.name,
      due_date: newBill.due_date || null,
      amount: parseFloat(newBill.amount) || 0,
      status: newBill.status,
      recurring: newBill.recurring,
    });
    setNewBill({ name: '', amount: '', due_date: '', icon: '💳', status: 'pending', recurring: false });
    setAddBillModal(false);
    loadBills();
  }

  async function updateBillStatus(id: string, status: Bill['status']) {
    await supabase.from('bills').update({ status }).eq('id', id);
    setBills(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }

  async function deleteBill(id: string) {
    await supabase.from('bills').delete().eq('id', id);
    setBills(prev => prev.filter(b => b.id !== id));
  }

  async function saveGoal() {
    if (!userId || !newGoal.title.trim() || !newGoal.target_amount) return;
    await supabase.from('savings_goals').insert({
      user_id: userId,
      user_profile: profile,
      title: newGoal.title,
      target_amount: parseFloat(newGoal.target_amount),
      current_amount: parseFloat(newGoal.current_amount || '0'),
      icon: newGoal.icon,
    });
    setNewGoal({ title: '', target_amount: '', current_amount: '', icon: '🎯' });
    setAddGoalModal(false);
    loadGoals();
  }

  async function updateGoalAmount(id: string, current_amount: number) {
    await supabase.from('savings_goals').update({ current_amount }).eq('id', id);
    setSavingsGoals(prev => prev.map(g => g.id === id ? { ...g, current_amount } : g));
  }

  async function saveBudgetCategory() {
    if (!userId || !newBudget.name.trim() || !newBudget.monthly_limit) return;
    await supabase.from('budget_categories').insert({
      user_id: userId,
      user_profile: profile,
      name: newBudget.name,
      monthly_limit: parseFloat(newBudget.monthly_limit),
      icon: newBudget.icon,
      color: newBudget.color,
    });
    setNewBudget({ name: '', monthly_limit: '', icon: '💰', color: '#C07B5A' });
    setAddBudgetModal(false);
    loadBudget();
  }

  const statusVariant = (s: Bill['status']) =>
    s === 'paid' ? 'green' : s === 'overdue' ? 'red' : 'amber';

  const overdueBills = bills.filter(b => b.status === 'overdue');
  const pendingBills = bills.filter(b => b.status === 'pending');
  const paidBills = bills.filter(b => b.status === 'paid');
  const totalOwed = bills.filter(b => b.status !== 'paid').reduce((s, b) => s + b.amount, 0);

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'budget', label: 'Budget' },
    { key: 'goals', label: 'Goals' },
  ];

  const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Finance</Text>
          <Text style={[styles.pageSub, { color: theme.textSub }]}>{monthLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.plaidBtn, { backgroundColor: theme.accentSoft }]}
          onPress={() => setPlaidModal(true)}
        >
          <Text style={[styles.plaidBtnText, { color: theme.accent }]}>+ Connect bank</Text>
        </TouchableOpacity>
      </View>

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

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            {/* Summary */}
            {bills.length > 0 && (
              <View style={[styles.hero, { backgroundColor: theme.heroBackground }]}>
                <Text style={[styles.heroLabel, { color: theme.heroSub }]}>OUTSTANDING</Text>
                <Text style={[styles.heroAmt, { color: theme.heroText }]}>${totalOwed.toFixed(2)}</Text>
                <Text style={[styles.heroSubText, { color: theme.heroSub }]}>
                  {pendingBills.length} pending · {overdueBills.length} overdue · {paidBills.length} paid
                </Text>
              </View>
            )}

            {/* Bills */}
            <View style={styles.section}>
              <SectionHeader title="Bills" action="+ Add" onAction={() => setAddBillModal(true)} />
              {bills.length === 0 ? (
                <View style={[styles.emptyState, { marginTop: 8 }]}>
                  <Text style={styles.emptyEmoji}>💳</Text>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>No bills yet</Text>
                  <Text style={[styles.emptySub, { color: theme.textSub }]}>Add your recurring bills to track what's due</Text>
                  <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setAddBillModal(true)}>
                    <Text style={styles.emptyBtnText}>Add first bill</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Card noPad>
                  {bills.map((b, i) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.row, { borderBottomColor: theme.borderLight }, i === bills.length - 1 && { borderBottomWidth: 0 }]}
                      onLongPress={() => {
                        const nextStatus: Bill['status'] = b.status === 'pending' ? 'paid' : b.status === 'paid' ? 'overdue' : 'pending';
                        updateBillStatus(b.id, nextStatus);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: b.status === 'overdue' ? '#FDECEA' : theme.accentDim }]}>
                        <Text style={{ fontSize: 16 }}>{b.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: theme.text }]}>{b.name}</Text>
                        <Text style={[styles.rowSub, { color: theme.textSub }]}>
                          {b.due_date ? `Due ${b.due_date}` : 'No due date'}{b.recurring ? ' · Recurring' : ''}
                        </Text>
                      </View>
                      <Chip
                        label={b.status === 'paid' ? 'Paid' : `$${b.amount.toFixed(2)}`}
                        variant={statusVariant(b.status)}
                      />
                    </TouchableOpacity>
                  ))}
                </Card>
              )}
              {bills.length > 0 && (
                <Text style={[styles.hintText, { color: theme.textMuted }]}>Long-press a bill to cycle its status</Text>
              )}
            </View>

            <AIInsightCard text={insight} loading={insightLoading} />
          </>
        )}

        {/* ── BUDGET TAB ── */}
        {activeTab === 'budget' && (
          <View style={styles.section}>
            <SectionHeader title="Monthly budget" action="+ Category" onAction={() => setAddBudgetModal(true)} />
            {budgetCategories.length === 0 ? (
              <View style={[styles.emptyState, { marginTop: 12 }]}>
                <Text style={styles.emptyEmoji}>💰</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No budget categories yet</Text>
                <Text style={[styles.emptySub, { color: theme.textSub }]}>Add categories like Groceries, Gas, and Dining Out to track spending</Text>
                <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setAddBudgetModal(true)}>
                  <Text style={styles.emptyBtnText}>Create first budget</Text>
                </TouchableOpacity>
              </View>
            ) : (
              budgetCategories.map(cat => {
                const spent = cat.spent ?? 0;
                const pct = Math.min(100, Math.round((spent / cat.monthly_limit) * 100));
                const over = spent > cat.monthly_limit;
                return (
                  <View key={cat.id} style={[styles.budgetCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={[styles.budgetIcon, { backgroundColor: cat.color + '18' }]}>
                      <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.budgetRow}>
                        <Text style={[styles.budgetName, { color: theme.text }]}>{cat.name}</Text>
                        <Text style={[styles.budgetLimit, { color: over ? '#E53935' : theme.textSub }]}>${spent.toFixed(0)} / ${cat.monthly_limit}/mo</Text>
                      </View>
                      <View style={[styles.barBg, { backgroundColor: theme.progressBg, marginTop: 6 }]}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: over ? '#E53935' : cat.color }]} />
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── GOALS TAB ── */}
        {activeTab === 'goals' && (
          <View style={styles.section}>
            <SectionHeader title="Savings goals" action="+ Goal" onAction={() => setAddGoalModal(true)} />
            {savingsGoals.length === 0 ? (
              <View style={[styles.emptyState, { marginTop: 12 }]}>
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No savings goals yet</Text>
                <Text style={[styles.emptySub, { color: theme.textSub }]}>Set goals for things like vacation, home repairs, or an emergency fund</Text>
                <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.accent }]} onPress={() => setAddGoalModal(true)}>
                  <Text style={styles.emptyBtnText}>Create first goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              savingsGoals.map(goal => {
                const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
                return (
                  <View key={goal.id} style={[styles.goalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.goalHeader}>
                      <Text style={styles.goalEmoji}>{goal.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.goalTitle, { color: theme.text }]}>{goal.title}</Text>
                        {goal.target_date && (
                          <Text style={[styles.goalDate, { color: theme.textSub }]}>
                            By {new Date(goal.target_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.goalPct, { color: theme.accent }]}>{pct}%</Text>
                    </View>
                    <View style={[styles.barBg, { backgroundColor: theme.progressBg, marginTop: 10 }]}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: theme.sage }]} />
                    </View>
                    <View style={styles.goalFooter}>
                      <Text style={[styles.goalCurrent, { color: theme.text }]}>${goal.current_amount.toFixed(0)} saved</Text>
                      <Text style={[styles.goalTarget, { color: theme.textSub }]}>of ${goal.target_amount.toFixed(0)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── PLAID INFO MODAL ── */}
      <Modal visible={plaidModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay2} onPress={() => setPlaidModal(false)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
              <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
              <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🏦</Text>
              <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center' }]}>Connect Your Bank</Text>
              <Text style={[styles.modalBody, { color: theme.textSub }]}>
                Bank account connection via Plaid requires a development build of the app.{'\n\n'}
                To enable this feature, the app needs to be built natively via Expo EAS Build rather than Expo Go.{'\n\n'}
                In the meantime, manually track your bills, budgets, and savings goals here. Everything syncs with the web app at your account.
              </Text>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={() => setPlaidModal(false)}>
                <Text style={styles.saveBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── ADD BILL MODAL ── */}
      <Modal visible={addBillModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddBillModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add bill</Text>

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>ICON</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {ICON_OPTIONS.map(icon => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconPick, { backgroundColor: newBill.icon === icon ? theme.accent : theme.surfaceAlt }]}
                    onPress={() => setNewBill(p => ({ ...p, icon }))}
                  >
                    <Text style={{ fontSize: 20 }}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {[
              { label: 'BILL NAME', key: 'name', placeholder: 'e.g. Electric, Mortgage, Netflix' },
              { label: 'AMOUNT ($)', key: 'amount', placeholder: '0.00', keyboard: 'decimal-pad' },
              { label: 'DUE DATE', key: 'due_date', placeholder: 'e.g. Apr 15' },
            ].map(({ label, key, placeholder, keyboard }) => (
              <View key={key}>
                <Text style={[styles.inputLabel, { color: theme.textSub }]}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
                  placeholder={placeholder}
                  placeholderTextColor={theme.textMuted}
                  keyboardType={(keyboard as any) ?? 'default'}
                  value={(newBill as any)[key]}
                  onChangeText={v => setNewBill(p => ({ ...p, [key]: v }))}
                />
              </View>
            ))}

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>STATUS</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
              {BILL_STATUSES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusChip, { backgroundColor: newBill.status === s ? theme.accent : theme.surfaceAlt }]}
                  onPress={() => setNewBill(p => ({ ...p, status: s }))}
                >
                  <Text style={[styles.statusChipText, { color: newBill.status === s ? '#fff' : theme.textSub }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={saveBill}>
              <Text style={styles.saveBtnText}>Save bill</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddBillModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ADD SAVINGS GOAL MODAL ── */}
      <Modal visible={addGoalModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddGoalModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>New savings goal</Text>
            {[
              { label: 'GOAL NAME', key: 'title', placeholder: 'e.g. Emergency fund, Vacation' },
              { label: 'TARGET AMOUNT ($)', key: 'target_amount', placeholder: '1000.00', keyboard: 'decimal-pad' },
              { label: 'ALREADY SAVED ($)', key: 'current_amount', placeholder: '0.00', keyboard: 'decimal-pad' },
              { label: 'ICON (EMOJI)', key: 'icon', placeholder: '🎯' },
            ].map(({ label, key, placeholder, keyboard }) => (
              <View key={key}>
                <Text style={[styles.inputLabel, { color: theme.textSub }]}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
                  placeholder={placeholder}
                  placeholderTextColor={theme.textMuted}
                  keyboardType={(keyboard as any) ?? 'default'}
                  value={(newGoal as any)[key]}
                  onChangeText={v => setNewGoal(p => ({ ...p, [key]: v }))}
                />
              </View>
            ))}
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.sage }]} onPress={saveGoal}>
              <Text style={styles.saveBtnText}>Create goal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddGoalModal(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── ADD BUDGET CATEGORY MODAL ── */}
      <Modal visible={addBudgetModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddBudgetModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add budget category</Text>
            {[
              { label: 'CATEGORY NAME', key: 'name', placeholder: 'e.g. Groceries, Gas, Dining' },
              { label: 'MONTHLY LIMIT ($)', key: 'monthly_limit', placeholder: '500.00', keyboard: 'decimal-pad' },
              { label: 'ICON (EMOJI)', key: 'icon', placeholder: '🛒' },
            ].map(({ label, key, placeholder, keyboard }) => (
              <View key={key}>
                <Text style={[styles.inputLabel, { color: theme.textSub }]}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
                  placeholder={placeholder}
                  placeholderTextColor={theme.textMuted}
                  keyboardType={(keyboard as any) ?? 'default'}
                  value={(newBudget as any)[key]}
                  onChangeText={v => setNewBudget(p => ({ ...p, [key]: v }))}
                />
              </View>
            ))}
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={saveBudgetCategory}>
              <Text style={styles.saveBtnText}>Add category</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddBudgetModal(false)}>
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
  plaidBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginTop: 6 },
  plaidBtnText: { fontSize: 13, fontWeight: '600' },
  subTabs: { flexDirection: 'row', borderRadius: 12, padding: 3, marginHorizontal: 16, marginTop: 12 },
  subTab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  subTabText: { fontSize: 11, fontWeight: '600' },
  hero: { borderRadius: 20, marginHorizontal: 16, marginTop: 14, padding: 20 },
  heroLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  heroAmt: { fontSize: 38, fontWeight: '700', letterSpacing: -1, marginVertical: 4 },
  heroSubText: { fontSize: 12 },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  hintText: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '500' },
  rowSub: { fontSize: 11, marginTop: 1 },
  barBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  budgetCard: { borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  budgetIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  budgetName: { fontSize: 15, fontWeight: '600' },
  budgetLimit: { fontSize: 12 },
  goalCard: { borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalEmoji: { fontSize: 28 },
  goalTitle: { fontSize: 16, fontWeight: '600' },
  goalDate: { fontSize: 11, marginTop: 2 },
  goalPct: { fontSize: 20, fontWeight: '700' },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  goalCurrent: { fontSize: 13, fontWeight: '600' },
  goalTarget: { fontSize: 13 },
  emptyState: { borderRadius: 20, padding: 28, alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  iconPick: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusChip: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  statusChipText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay2: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalBody: { fontSize: 15, lineHeight: 24, marginVertical: 12 },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  saveBtn: { padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { fontSize: 13 },
});
