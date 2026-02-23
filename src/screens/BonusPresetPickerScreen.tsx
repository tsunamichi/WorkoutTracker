import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, CARDS } from '../constants';
import { IconArrowLeft } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { BonusLog, BonusType, ExerciseInstanceWithCycle } from '../types/training';

type RouteParams = RouteProp<RootStackParamList, 'BonusPresetPicker'>;

type PresetOption = {
  id: string;
  name: string;
  items?: ExerciseInstanceWithCycle[];
};

export function BonusPresetPickerScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { bonusType } = route.params;
  const {
    hiitTimers,
    warmupPresets,
    corePresets,
    workoutTemplates,
    addBonusLog,
  } = useStore();

  const title = bonusType === 'timer' ? t('timer')
    : bonusType === 'warmup' ? t('warmUp')
    : t('core');

  const presets: PresetOption[] = useMemo(() => {
    if (bonusType === 'timer') {
      return hiitTimers.filter(t => t.isTemplate).map(t => ({ id: t.id, name: t.name }));
    }

    // Standalone presets
    const standalone = bonusType === 'warmup'
      ? warmupPresets.map(p => ({ id: p.id, name: p.name, items: p.items }))
      : corePresets.map(p => ({ id: p.id, name: p.name, items: p.items }));

    // Derive additional presets from workout templates that have warmup/core items
    const fromTemplates = workoutTemplates
      .filter(wt => {
        const items = bonusType === 'warmup' ? wt.warmupItems : wt.accessoryItems;
        return items && items.length > 0;
      })
      .map(wt => ({
        id: `wt-${wt.id}`,
        name: wt.name,
        items: (bonusType === 'warmup' ? wt.warmupItems : wt.accessoryItems) as ExerciseInstanceWithCycle[],
      }));

    return [...standalone, ...fromTemplates];
  }, [bonusType, hiitTimers, warmupPresets, corePresets, workoutTemplates]);

  const handleSelect = async (preset: PresetOption) => {
    const today = dayjs().format('YYYY-MM-DD');
    const log: BonusLog = {
      id: `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: today,
      type: bonusType as BonusType,
      presetId: preset.id,
      presetName: preset.name,
      createdAt: new Date().toISOString(),
      status: 'planned',
      completedAt: null,
    };

    if (bonusType === 'timer') {
      log.timerPayload = { timerTemplateId: preset.id };
    } else {
      log.exercisePayload = {
        items: preset.items ? [...preset.items] : [],
        completedItems: [],
      };
    }

    await addBonusLog(log);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {presets.length === 0 ? (
          <Text style={styles.emptyText}>{t('noPresetsYet')}</Text>
        ) : (
          presets.map((preset) => (
            <TouchableOpacity
              key={preset.id}
              style={styles.presetCard}
              onPress={() => handleSelect(preset)}
              activeOpacity={0.7}
            >
              <View style={styles.presetCardInner}>
                <Text style={styles.presetName}>{preset.name}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
    marginTop: SPACING.xxxl,
  },
  presetCard: {
    ...CARDS.cardDeepDimmed.outer,
  },
  presetCardInner: {
    ...CARDS.cardDeepDimmed.inner,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  presetName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
});
