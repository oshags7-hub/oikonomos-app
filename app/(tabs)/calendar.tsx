import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView,
  Platform, Alert, Linking,
} from 'react-native';
import * as Calendar from 'expo-calendar';
import { useProfile } from '@/contexts/ProfileContext';
import { AIInsightCard } from '@/components/AIInsightCard';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { getInsight } from '@/lib/anthropic';

type CalEvent = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  calendarName?: string;
  calendarColor?: string;
  notes?: string;
};

type ConnectedCalendar = {
  id: string;
  title: string;
  color: string;
  source: string;
  allowsModifications: boolean;
};

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function buildCalendar(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const total = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    if (i < firstDay) return { day: daysInPrev - firstDay + i + 1, current: false };
    if (i >= firstDay + daysInMonth) return { day: i - firstDay - daysInMonth + 1, current: false };
    return { day: i - firstDay + 1, current: true };
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function CalendarScreen() {
  const { theme } = useProfile();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  const [calPermission, setCalPermission] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [calModal, setCalModal] = useState(false);
  const [addEventModal, setAddEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', notes: '', allDay: true });
  const [insight, setInsight] = useState('Connect your Apple or Google Calendar to see all your events here.');
  const [insightLoading, setInsightLoading] = useState(false);

  // Check permissions on mount
  useEffect(() => {
    Calendar.getCalendarPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setCalPermission('granted');
      } else {
        setCalPermission('undetermined');
      }
    });
  }, []);

  // Load calendars and events when permission granted
  useEffect(() => {
    if (calPermission === 'granted') {
      loadCalendars();
    }
  }, [calPermission]);

  useEffect(() => {
    if (calPermission === 'granted') {
      loadEventsForMonth();
    }
  }, [calPermission, year, month]);

  const loadCalendars = useCallback(async () => {
    try {
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      setCalendars(cals.map(c => ({
        id: c.id,
        title: c.title,
        color: c.color ?? '#7B5EA7',
        source: c.source?.name ?? 'Unknown',
        allowsModifications: c.allowsModifications ?? false,
      })));
    } catch { /* ignore */ }
  }, []);

  const loadEventsForMonth = useCallback(async () => {
    try {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      const calEvents = await Calendar.getEventsAsync(
        (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).map(c => c.id),
        start,
        end,
      );
      setEvents(calEvents.map(e => ({
        id: e.id,
        title: e.title,
        startDate: new Date(e.startDate),
        endDate: new Date(e.endDate),
        allDay: e.allDay,
        calendarName: e.calendarId,
        notes: e.notes ?? undefined,
      })));

      // Load AI insight from upcoming events
      if (calEvents.length > 0) {
        const upcoming = calEvents
          .filter(e => new Date(e.startDate) >= today)
          .slice(0, 5)
          .map(e => e.title);
        if (upcoming.length > 0) {
          setInsightLoading(true);
          try {
            const text = await getInsight({ screen: 'calendar', data: { upcoming } });
            setInsight(text);
          } catch { /* keep default */ }
          finally { setInsightLoading(false); }
        }
      }
    } catch { /* ignore */ }
  }, [year, month]);

  async function requestPermission() {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
      setCalPermission('granted');
      setCalModal(false);
    } else {
      setCalPermission('denied');
      Alert.alert(
        'Calendar access denied',
        'Please go to Settings → Privacy → Calendars → Oikonomos and enable access.',
        [
          { text: 'Open Settings', onPress: () => Linking.openURL('app-settings:') },
          { text: 'Cancel' },
        ],
      );
    }
  }

  async function addEvent() {
    if (!newEvent.title.trim()) return;
    try {
      // Find first writable calendar (prefer iCloud or local)
      const writableCals = (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT))
        .filter(c => c.allowsModifications);
      if (writableCals.length === 0) {
        Alert.alert('No writable calendar', 'No calendar found that allows adding events.');
        return;
      }
      const cal = writableCals[0];
      const start = new Date(year, month, selectedDay, 9, 0, 0);
      const end = new Date(year, month, selectedDay, 10, 0, 0);
      await Calendar.createEventAsync(cal.id, {
        title: newEvent.title,
        startDate: start,
        endDate: end,
        allDay: newEvent.allDay,
        notes: newEvent.notes || undefined,
      });
      setNewEvent({ title: '', notes: '', allDay: true });
      setAddEventModal(false);
      loadEventsForMonth();
      Alert.alert('Event added', `"${newEvent.title}" added to ${cal.title}`);
    } catch (e) {
      Alert.alert('Could not add event', String(e));
    }
  }

  const selectedDateEvents = events.filter(e => {
    const d = e.startDate;
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay;
  }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Build a set of days that have events for the dot indicators
  const eventDays = new Set(events.map(e => e.startDate.getDate()));

  const cells = buildCalendar(year, month);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  const calSourceLabel = () => {
    if (calPermission !== 'granted') return null;
    const sources = [...new Set(calendars.map(c => c.source))].filter(Boolean);
    if (sources.length === 0) return 'Calendar connected';
    return sources.join(', ') + ' synced';
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={[styles.pageTitle, { color: theme.text }]}>Calendar</Text>
            <Text style={[styles.pageSub, { color: theme.textSub }]}>
              {MONTH_NAMES[month]} {year}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
            {calPermission === 'granted' ? (
              <TouchableOpacity
                style={[styles.syncChip, { backgroundColor: theme.chipGreenBg }]}
                onPress={() => setCalModal(true)}
              >
                <Text style={[styles.syncText, { color: theme.chipGreenText }]}>● {calSourceLabel()}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.connectBtn, { backgroundColor: theme.accentSoft }]}
                onPress={() => setCalModal(true)}
              >
                <Text style={[styles.connectBtnText, { color: theme.accent }]}>+ Connect calendar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={prevMonth}>
            <Text style={[styles.navBtnText, { color: theme.accent }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: theme.text }]}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity style={styles.navBtn} onPress={nextMonth}>
            <Text style={[styles.navBtnText, { color: theme.accent }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Days of week */}
        <View style={styles.dowRow}>
          {DAYS_OF_WEEK.map((d, i) => (
            <Text key={i} style={[styles.dowLabel, { color: theme.textSub }]}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.calGrid}>
          {cells.map((cell, i) => {
            const isToday = cell.current && cell.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = cell.current && cell.day === selectedDay;
            const hasEvent = cell.current && eventDays.has(cell.day);
            return (
              <TouchableOpacity
                key={i}
                style={styles.calCell}
                onPress={() => cell.current && setSelectedDay(cell.day)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.dayNum,
                  isToday && { backgroundColor: theme.accent },
                  isSelected && !isToday && { backgroundColor: theme.accentDim },
                ]}>
                  <Text style={[
                    styles.dayNumText,
                    { color: cell.current ? theme.text : theme.textMuted },
                    (isToday || isSelected) && { color: isToday ? '#fff' : theme.accent, fontWeight: '700' },
                  ]}>
                    {cell.day}
                  </Text>
                </View>
                {hasEvent && <View style={[styles.eventDot, { backgroundColor: theme.accent }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected day events */}
        <View style={styles.section}>
          <SectionHeader
            title={`${MONTH_NAMES[month]} ${selectedDay} · ${new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long' })}`}
            action="+ Add event"
            onAction={() => calPermission === 'granted' ? setAddEventModal(true) : setCalModal(true)}
          />

          {calPermission !== 'granted' ? (
            <TouchableOpacity
              style={[styles.connectCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              onPress={() => setCalModal(true)}
            >
              <Text style={styles.connectCardEmoji}>📅</Text>
              <Text style={[styles.connectCardTitle, { color: theme.text }]}>Connect your calendar</Text>
              <Text style={[styles.connectCardSub, { color: theme.textSub }]}>See Apple Calendar, Google Calendar, and more</Text>
            </TouchableOpacity>
          ) : selectedDateEvents.length === 0 ? (
            <View style={[styles.emptyDay, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <Text style={[styles.emptyDayText, { color: theme.textMuted }]}>No events · tap + to add one</Text>
            </View>
          ) : (
            <Card noPad>
              {selectedDateEvents.map((e, i) => (
                <View
                  key={e.id}
                  style={[styles.eventRow, { borderBottomColor: theme.borderLight }, i === selectedDateEvents.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={[styles.eventBar, { backgroundColor: theme.accent }]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.eventTitle, { color: theme.text }]}>{e.title}</Text>
                    <Text style={[styles.eventTime, { color: theme.textSub }]}>
                      {e.allDay ? 'All day' : `${formatTime(e.startDate)} – ${formatTime(e.endDate)}`}
                    </Text>
                    {e.notes && <Text style={[styles.eventNotes, { color: theme.textMuted }]} numberOfLines={1}>{e.notes}</Text>}
                  </View>
                </View>
              ))}
            </Card>
          )}
        </View>

        <AIInsightCard text={insight} loading={insightLoading} />
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── CONNECT CALENDAR MODAL ── */}
      <Modal visible={calModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay2} onPress={() => setCalModal(false)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
              <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
              <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>📅</Text>
              <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center' }]}>Connect Your Calendar</Text>

              {calPermission === 'granted' ? (
                <>
                  <Text style={[styles.modalBody, { color: theme.textSub }]}>
                    ✅ Calendar access is active. Oikonomos is reading from:
                  </Text>
                  {calendars.slice(0, 6).map(c => (
                    <View key={c.id} style={[styles.calRow, { borderBottomColor: theme.borderLight }]}>
                      <View style={[styles.calDot, { backgroundColor: c.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.calName, { color: theme.text }]}>{c.title}</Text>
                        <Text style={[styles.calSource, { color: theme.textSub }]}>{c.source}</Text>
                      </View>
                    </View>
                  ))}
                  <Text style={[styles.modalNote, { color: theme.textMuted }]}>
                    Google Calendar events appear here automatically if your Google account is added in iPhone Settings → Contacts/Calendars.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.modalBody, { color: theme.textSub }]}>
                    Connect your device calendar to see all events here — including Google Calendar if it's synced to your iPhone.{'\n\n'}
                    <Text style={{ fontWeight: '600', color: theme.text }}>Google Calendar:</Text> Add your Google account in{' '}
                    <Text style={{ fontStyle: 'italic' }}>iPhone Settings → Mail → Accounts → Add Account → Google</Text>, then enable Calendars.
                  </Text>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: theme.accent }]}
                    onPress={requestPermission}
                  >
                    <Text style={styles.saveBtnText}>Allow Calendar Access</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCalModal(false)}>
                <Text style={[styles.cancelBtnText, { color: theme.textSub }]}>
                  {calPermission === 'granted' ? 'Done' : 'Not now'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── ADD EVENT MODAL ── */}
      <Modal visible={addEventModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setAddEventModal(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.modalBackground }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              New event · {MONTH_NAMES[month]} {selectedDay}
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>TITLE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="e.g. Doctor appointment"
              placeholderTextColor={theme.textMuted}
              value={newEvent.title}
              onChangeText={v => setNewEvent(p => ({ ...p, title: v }))}
              autoFocus
            />

            <Text style={[styles.inputLabel, { color: theme.textSub }]}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder, color: theme.text }]}
              placeholder="Add any notes..."
              placeholderTextColor={theme.textMuted}
              value={newEvent.notes}
              onChangeText={v => setNewEvent(p => ({ ...p, notes: v }))}
            />

            <View style={styles.allDayRow}>
              <Text style={[styles.allDayLabel, { color: theme.text }]}>All day</Text>
              <TouchableOpacity
                style={[styles.toggle, { backgroundColor: newEvent.allDay ? theme.accent : theme.surfaceAlt }]}
                onPress={() => setNewEvent(p => ({ ...p, allDay: !p.allDay }))}
              >
                <View style={[styles.toggleThumb, newEvent.allDay && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={addEvent}>
              <Text style={styles.saveBtnText}>Add to Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddEventModal(false)}>
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
  syncChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  syncText: { fontSize: 10, fontWeight: '600' },
  connectBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  connectBtnText: { fontSize: 12, fontWeight: '600' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 20 },
  navBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navBtnText: { fontSize: 26, fontWeight: '300' },
  monthLabel: { fontSize: 15, fontWeight: '600', width: 160, textAlign: 'center' },
  dowRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 },
  calCell: { width: '14.28%', minHeight: 40, borderRadius: 8, paddingVertical: 3, alignItems: 'center' },
  dayNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  dayNumText: { fontSize: 12, fontWeight: '400' },
  eventDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  section: { paddingHorizontal: 16, paddingTop: 14 },
  connectCard: { borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' },
  connectCardEmoji: { fontSize: 32, marginBottom: 8 },
  connectCardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  connectCardSub: { fontSize: 13, textAlign: 'center' },
  emptyDay: { borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1 },
  emptyDayText: { fontSize: 13 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  eventBar: { width: 3, height: 36, borderRadius: 2, flexShrink: 0 },
  eventTitle: { fontSize: 14, fontWeight: '500' },
  eventTime: { fontSize: 11, marginTop: 1 },
  eventNotes: { fontSize: 11, marginTop: 2 },
  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay2: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 32, height: 3, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalBody: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  modalNote: { fontSize: 12, lineHeight: 19, marginTop: 12, fontStyle: 'italic' },
  calRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  calDot: { width: 10, height: 10, borderRadius: 5 },
  calName: { fontSize: 14, fontWeight: '500' },
  calSource: { fontSize: 11, marginTop: 1 },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 14, marginBottom: 6, color: '#7D6E62' },
  input: { borderWidth: 0.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  allDayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 },
  allDayLabel: { fontSize: 15, fontWeight: '500' },
  toggle: { width: 44, height: 26, borderRadius: 13, padding: 2, justifyContent: 'center' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  saveBtn: { padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { padding: 10, alignItems: 'center', marginTop: 4 },
  cancelBtnText: { fontSize: 13 },
});
