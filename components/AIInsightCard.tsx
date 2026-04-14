import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';

type Props = {
  text?: string;
  loading?: boolean;
};

export function AIInsightCard({ text, loading = false }: Props) {
  const { theme } = useProfile();

  return (
    <View style={[styles.container, { backgroundColor: theme.aiBackground, borderColor: theme.aiBorder }]}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: theme.aiDot }]}>
          <Text style={[styles.dotIcon, { color: theme.aiDotIcon }]}>✦</Text>
        </View>
        <Text style={[styles.label, { color: theme.aiLabel }]}>OIKONOMOS AI</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.aiLabel} style={{ marginTop: 4 }} />
      ) : (
        <Text style={[styles.text, { color: theme.aiText }]}>{text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 14,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIcon: {
    fontSize: 11,
    lineHeight: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  text: {
    fontSize: 13,
    lineHeight: 21,
  },
});
