import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) { Alert.alert('Please fill in all fields'); return; }
    if (p.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      if (mode === 'signin') {
        const error = await signIn(e, p);
        if (error) Alert.alert('Sign in failed', error);
        else router.replace('/(tabs)');
      } else {
        const error = await signUp(e, p);
        if (error) {
          Alert.alert('Sign up failed', error);
        } else {
          Alert.alert(
            'Check your email',
            'We sent a confirmation link. Click it, then sign in here.',
            [{ text: 'OK', onPress: () => setMode('signin') }],
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoEmoji}>🏡</Text>
            </View>
            <Text style={styles.wordmark}>
              Oikonom<Text style={{ color: '#C07B5A' }}>os</Text>
            </Text>
            <Text style={styles.tagline}>HOUSEHOLD STEWARD</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === 'signin' ? 'Welcome back' : 'Create your household'}
            </Text>
            <Text style={styles.cardSub}>
              {mode === 'signin'
                ? 'Sign in to your Oikonomos account'
                : 'One account for your whole household'}
            </Text>

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#B0A898"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
            />

            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#B0A898"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>
                {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              <Text style={styles.toggleText}>
                {mode === 'signin' ? "New to Oikonomos? " : 'Already have an account? '}
                <Text style={styles.toggleLink}>
                  {mode === 'signin' ? 'Create account' : 'Sign in'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Features preview */}
          <View style={styles.features}>
            {[
              { icon: '💳', text: 'Track bills & budgets' },
              { icon: '🍽️', text: 'Meal planning & shopping' },
              { icon: '📖', text: 'Bible reading & prayer' },
              { icon: '✏️', text: 'Homeschool planner' },
            ].map(f => (
              <View key={f.text} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDFCF8' },
  container: { paddingHorizontal: 24, paddingTop: 32 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: '#F5EDE6', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#C07B5A', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  logoEmoji: { fontSize: 34 },
  wordmark: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: '#1A1412' },
  tagline: { fontSize: 9, fontWeight: '700', letterSpacing: 2, color: '#B0A898', marginTop: 3 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 20, shadowOffset: { width: 0, height: 4 },
    marginBottom: 24,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#1A1412', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#7D6E62', marginBottom: 20, lineHeight: 21 },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: '#7D6E62', marginBottom: 7 },
  input: {
    borderWidth: 1, borderColor: '#E8E0D8', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13, fontSize: 16,
    color: '#1A1412', backgroundColor: '#FDFCF8', marginBottom: 16,
  },
  btn: {
    backgroundColor: '#C07B5A', borderRadius: 16,
    paddingVertical: 15, alignItems: 'center', marginTop: 4,
    shadowColor: '#C07B5A', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EEE8E0' },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#B0A898', fontWeight: '500' },
  toggleBtn: { alignItems: 'center' },
  toggleText: { fontSize: 14, color: '#7D6E62' },
  toggleLink: { color: '#C07B5A', fontWeight: '600' },
  features: { gap: 12 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 18, width: 28 },
  featureText: { fontSize: 14, color: '#7D6E62', fontWeight: '500' },
});
