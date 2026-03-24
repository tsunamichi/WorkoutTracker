import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { BottomDrawer } from '../common/BottomDrawer';
import { Toggle } from '../Toggle';
import { EXPLORE_V2 } from './exploreV2Tokens';
import { EXPLORE_V2_PALETTES } from './exploreV2ColorSystem';
import { TYPOGRAPHY } from '../../constants';
import { COLORS } from '../../constants';
import { IconSwap, IconTrash } from '../icons';
import type { ExploreV2Exercise } from './exploreV2Types';
import { useTranslation } from '../../i18n/useTranslation';

type Props = {
  visible: boolean;
  onClose: () => void;
  exercise: ExploreV2Exercise;
  /** template item id for progression */
  templateItemId: string;
  libraryExerciseId: string | undefined;
  useKg: boolean;
  getBarbellMode: (id: string) => boolean;
  setBarbellMode: (id: string, v: boolean) => void;
  timeBased: boolean;
  onTimeBasedChange: (v: boolean) => void;
  perSide: boolean;
  onPerSideChange: (v: boolean) => void;
  progressionGroups: Array<{ id: string; name: string; exerciseIds: string[] }>;
  currentProgressionGroupId: string | null;
  onProgressionGroupSelect: (groupId: string | null) => void | Promise<void>;
  onSwap: () => void;
  onDelete: () => void;
  type: 'warmup' | 'main' | 'core';
};

export function ExploreV2CurrentOverflowSheet({
  visible,
  onClose,
  exercise,
  templateItemId,
  libraryExerciseId,
  useKg,
  getBarbellMode,
  setBarbellMode,
  timeBased,
  onTimeBasedChange,
  perSide,
  onPerSideChange,
  progressionGroups,
  currentProgressionGroupId,
  onProgressionGroupSelect,
  onSwap,
  onDelete,
  type,
}: Props) {
  const { t } = useTranslation();
  const libId = libraryExerciseId || exercise.id;
  const setupWeight =
    exercise.weight ?? 0;
  const showBarbellToggle = setupWeight > (useKg ? 20 : 45);
  const isBarbellMode = getBarbellMode(exercise.id);

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="88%"
      scrollable
      backgroundColor={EXPLORE_V2_PALETTES.current.soft}
      keyboardShouldPersistTaps="always"
    >
      <View style={styles.pad}>
        <Text style={styles.title} numberOfLines={2}>
          {exercise.exerciseName}
        </Text>
        <Text style={styles.sub}>Exercise settings</Text>

        <Text style={styles.section}>Structure</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Weight format</Text>
          <Toggle label="" hideLabel value={isBarbellMode} onValueChange={() => setBarbellMode(exercise.id, !isBarbellMode)} disabled={!showBarbellToggle} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Both sides</Text>
          <Toggle label="" hideLabel value={perSide} onValueChange={() => onPerSideChange(!perSide)} />
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Timed</Text>
          <Toggle label="" hideLabel value={timeBased} onValueChange={() => onTimeBasedChange(!timeBased)} />
        </View>

        {type === 'main' && (
          <>
            <Text style={styles.section}>Progression</Text>
            <View style={styles.pillRow}>
              <TouchableOpacity
                style={[styles.pill, currentProgressionGroupId === null && styles.pillOn]}
                onPress={() => onProgressionGroupSelect(null)}
              >
                <Text style={styles.pillText}>None</Text>
              </TouchableOpacity>
              {progressionGroups.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.pill, currentProgressionGroupId === g.id && styles.pillOn]}
                  onPress={() => onProgressionGroupSelect(g.id)}
                >
                  <Text style={styles.pillText} numberOfLines={1}>
                    {g.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={styles.divider} />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionCell} onPress={onSwap} activeOpacity={0.75}>
            <IconSwap size={18} color={COLORS.textMeta} />
            <Text style={styles.actionText}>Swap exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCell}
            onPress={() => {
              Alert.alert(t('deleteExerciseTitle'), t('deleteExerciseMessage'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('remove'), style: 'destructive', onPress: onDelete },
              ]);
            }}
            activeOpacity={0.75}
          >
            <IconTrash size={18} color={COLORS.signalNegative} />
            <Text style={[styles.actionText, { color: COLORS.signalNegative }]}>{t('remove')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: EXPLORE_V2.colors.textPrimary,
  },
  sub: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textMeta,
    marginBottom: 16,
  },
  section: {
    ...TYPOGRAPHY.metaBold,
    color: EXPLORE_V2.colors.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    ...TYPOGRAPHY.body,
    color: EXPLORE_V2.colors.textPrimary,
    flex: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: EXPLORE_V2.colors.divider,
  },
  pillOn: {
    borderColor: EXPLORE_V2.colors.accent,
    backgroundColor: 'rgba(200,255,61,0.12)',
  },
  pillText: {
    ...TYPOGRAPHY.meta,
    color: EXPLORE_V2.colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: EXPLORE_V2.colors.divider,
    marginVertical: 16,
  },
  actions: {
    gap: 8,
  },
  actionCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  actionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
});
