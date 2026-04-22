import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SPACING } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';
import { getAppThemeFromStore } from '../../theme/getAppThemeFromStore';

export function DragHandle({ testID }: { testID?: string }) {
  return (
    <View testID={testID} style={styles.container}>
      <View style={styles.handle} />
    </View>
  );
}

const themeColors = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: themeColors.border,
  },
});