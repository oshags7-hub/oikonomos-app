import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useProfile } from '@/contexts/ProfileContext';

const { width } = Dimensions.get('window');

export const ONBOARDING_KEY = 'oikonomos_onboarding_v1';

type Slide = {
  emoji: string;
  emojiAlt?: string;
  title: string;
  subtitle: string;
  body: string;
  accentColor: string;
};

const SLIDES: Slide[] = [
  {
    emoji: '🏡',
    title: 'Welcome to Oikonomos',
    subtitle: 'Your household, faithfully managed',
    body: 'Oikonomos is a Greek word meaning "household steward." This app helps you steward your home with grace — finances, meals, faith, and family all in one beautiful place.',
    accentColor: '#C07B5A',
  },
  {
    emoji: '📊',
    emojiAlt: '🏠',
    title: 'Your Household Dashboard',
    subtitle: 'Everything at a glance',
    body: 'Your dashboard shows bills due, home maintenance tasks, Bible reading progress, and grocery needs — with a daily AI briefing tailored just for you every morning.',
    accentColor: '#7A9068',
  },
  {
    emoji: '💳',
    title: 'Connect Your Bank',
    subtitle: 'Real-time financial clarity',
    body: 'Securely connect your bank accounts and credit cards. Track spending by category, set monthly budgets, and get gentle AI-powered insights to help your family thrive financially.',
    accentColor: '#C07B5A',
  },
  {
    emoji: '📖',
    title: 'Daily Bible Reading',
    subtitle: 'Nourish your soul every morning',
    body: 'Choose from curated reading plans — Bible in a Year, Psalms & Proverbs, and more — with the full ESV text built in. Track your streak, journal prayers, and let God\'s Word anchor your day.',
    accentColor: '#7B5EA7',
  },
  {
    emoji: '🍽️',
    emojiAlt: '📝',
    title: 'Meals & Shopping',
    subtitle: 'Plan smarter, save more',
    body: 'Plan your weekly meals, build your shopping list by voice ("add two gallons of milk"), and let the AI find the best prices at stores near you. Less stress, more savings.',
    accentColor: '#7A9068',
  },
  {
    emoji: '✨',
    title: 'You\'re All Set',
    subtitle: 'Your home. Your faith. Your peace.',
    body: 'Tap a tab below to explore any section. You can connect your bank, choose a Bible plan, or add to your shopping list any time. We\'re glad you\'re here.',
    accentColor: '#C07B5A',
  },
];

export default function OnboardingScreen() {
  const { theme } = useProfile();
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'done');
    router.replace('/(tabs)');
  }

  function next() {
    if (current < SLIDES.length - 1) {
      const next = current + 1;
      setCurrent(next);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
    } else {
      finish();
    }
  }

  function onScroll(e: any) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrent(idx);
  }

  const slide = SLIDES[current];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      {/* Skip */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }} />
        {current < SLIDES.length - 1 && (
          <TouchableOpacity onPress={finish} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.skipText, { color: theme.textSub }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            {/* Illustration area */}
            <View style={[styles.illustrationWrap, { backgroundColor: s.accentColor + '14' }]}>
              <View style={[styles.illustrationCircle, { backgroundColor: s.accentColor + '22' }]}>
                <Text style={styles.illustrationEmoji}>{s.emoji}</Text>
              </View>
              {s.emojiAlt && (
                <View style={[styles.illustrationBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={styles.illustrationBadgeEmoji}>{s.emojiAlt}</Text>
                </View>
              )}
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={[styles.subtitle, { color: s.accentColor }]}>{s.subtitle.toUpperCase()}</Text>
              <Text style={[styles.title, { color: theme.text }]}>{s.title}</Text>
              <Text style={[styles.body, { color: theme.textSub }]}>{s.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === current ? slide.accentColor : theme.onboardingDot },
                i === current && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: slide.accentColor }]}
          onPress={next}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {current === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
    height: 44,
  },
  skipText: { fontSize: 15, fontWeight: '500' },
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  illustrationWrap: {
    width: width - 64,
    height: 260,
    borderRadius: 32,
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  illustrationCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: { fontSize: 64 },
  illustrationBadge: {
    position: 'absolute',
    bottom: 28,
    right: 28,
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  illustrationBadgeEmoji: { fontSize: 24 },
  content: { marginTop: 36, alignItems: 'center' },
  subtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  bottomBar: {
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'ios' ? 24 : 32,
    paddingTop: 20,
    alignItems: 'center',
    gap: 20,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },
  dotActive: { width: 20, borderRadius: 3 },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
