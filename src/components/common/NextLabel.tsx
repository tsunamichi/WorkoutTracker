import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { TYPOGRAPHY } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { getAppThemeFromStore } from '../../theme/getAppThemeFromStore';

export const NextLabel = () => (
  <Text style={styles.label}>Next</Text>
);

const themeColors = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  label: {
    ...TYPOGRAPHY.legal,
    color: themeColors.signalWarning,
  },
});