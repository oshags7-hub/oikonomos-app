import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { useProfile } from '@/contexts/ProfileContext';

type Props = ViewProps & {
  children: React.ReactNode;
  noPad?: boolean;
};

export function Card({ children, noPad, style, ...rest }: Props) {
  const { theme } = useProfile();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        noPad && styles.noPad,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  noPad: {
    padding: 0,
  },
});
