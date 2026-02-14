import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressHeaderProps {
  stepLabel: string;  // e.g., "Step 1 of 4"
  title: string;      // e.g., "Set your schedule"
}

export function ProgressHeader({ stepLabel, title }: ProgressHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.stepLabel}>{stepLabel}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  stepLabel: {
    fontSize: 14,
    color: '#817B77',
    marginBottom: 8,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

