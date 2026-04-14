import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';

type ChipVariant = 'green' | 'amber' | 'red' | 'neutral' | 'purple';

type Props = {
  label: string;
  variant: ChipVariant;
};

export function Chip({ label, variant }: Props) {
  const { theme } = useProfile();

  const bgMap: Record<ChipVariant, string> = {
    green: theme.chipGreenBg,
    amber: theme.chipAmberBg,
    red: theme.chipRedBg,
    neutral: theme.chipNeutralBg,
    purple: theme.chipPurpleBg,
  };
  const textMap: Record<ChipVariant, string> = {
    green: theme.chipGreenText,
    amber: theme.chipAmberText,
    red: theme.chipRedText,
    neutral: theme.chipNeutralText,
    purple: theme.chipPurpleText,
  };

  return (
    <View style={[styles.chip, { backgroundColor: bgMap[variant] }]}>
      <Text style={[styles.label, { color: textMap[variant] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    whiteSpace: 'nowrap',
  } as any,
});
