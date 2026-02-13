import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants';

export const NextLabel = () => (
  <Text style={styles.label}>Next</Text>
);

const styles = StyleSheet.create({
  label: {
    ...TYPOGRAPHY.legal,
    color: COLORS.signalWarning,
  },
});
