import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';

export function ProfileToggle() {
  const { profile, setProfile, theme } = useProfile();

  return (
    <View style={[styles.container, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
      <TouchableOpacity
        style={[styles.button, profile === 'mom' && { backgroundColor: theme.accent }]}
        onPress={() => setProfile('mom')}
      >
        <Text style={[styles.label, { color: profile === 'mom' ? '#fff' : theme.textSub }]}>
          MOM
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, profile === 'dad' && { backgroundColor: theme.accent }]}
        onPress={() => setProfile('dad')}
      >
        <Text style={[styles.label, { color: profile === 'dad' ? (profile === 'dad' ? '#0F1117' : '#fff') : theme.textSub }]}>
          DAD
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
