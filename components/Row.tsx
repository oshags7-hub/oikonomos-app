import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';

type Props = {
  icon?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
};

export function Row({ icon, iconBg, title, subtitle, right, onPress, last = false }: Props) {
  const { theme } = useProfile();
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      onPress={onPress}
      style={[
        styles.row,
        { borderBottomColor: theme.borderLight },
        last && styles.lastRow,
      ]}
      activeOpacity={0.7}
    >
      {icon && (
        <View style={[styles.icon, { backgroundColor: iconBg ?? theme.accentDim }]}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: theme.textSub }]}>{subtitle}</Text>}
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: {
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  right: {
    flexShrink: 0,
  },
});
