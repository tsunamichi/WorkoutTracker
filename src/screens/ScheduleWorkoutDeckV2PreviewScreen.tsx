import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScheduleWorkoutDeckV3, type ScheduleDeckV3Item } from '../components/schedule/ScheduleWorkoutDeckV3';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';

export function ScheduleWorkoutDeckV2PreviewScreen() {
  const [mode, setMode] = useState<'queue' | 'inProgress'>('queue');
  const mockCards: ScheduleDeckV3Item[] = useMemo(
    () => [
      { id: 'm-1', title: 'Upper Push', subtitle: 'Shoulders & Chest', exerciseCount: 6 },
      { id: 'm-2', title: 'Lower Hinge', subtitle: 'Glutes & Hamstrings', exerciseCount: 5 },
      { id: 'm-3', title: 'Upper Pull', subtitle: 'Back & Biceps', exerciseCount: 6 },
      { id: 'm-4', title: 'Lower Body', subtitle: 'Quads & Core', exerciseCount: 5 },
    ],
    [],
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Deck V2 Preview</Text>
        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => setMode(m => (m === 'queue' ? 'inProgress' : 'queue'))}
        >
          <Text style={styles.modeText}>{mode === 'queue' ? 'Switch to inProgress' : 'Switch to queue'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.deckWrap}>
        <ScheduleWorkoutDeckV3
          items={mockCards}
          mode={mode}
          inProgressItem={mockCards[0]}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvasLight },
  header: { paddingHorizontal: SPACING.xxl, paddingTop: SPACING.md, paddingBottom: SPACING.lg },
  title: { ...TYPOGRAPHY.h2, color: COLORS.inkCharcoal },
  modeButton: { marginTop: SPACING.sm, alignSelf: 'flex-start' },
  modeText: { ...TYPOGRAPHY.body, color: COLORS.accentPrimary },
  deckWrap: { paddingHorizontal: SPACING.xxl, paddingTop: SPACING.sm },
});
