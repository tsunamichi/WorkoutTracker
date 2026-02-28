import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, CARDS, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconPlay, IconAdd, IconArrowRight } from '../components/icons';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';
import { createNewExerciseItem } from '../utils/exerciseMigration';
import { BUILTIN_CORE_TEMPLATES, resolveBuiltinCoreItems } from '../constants/coreTemplates';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { BonusLog, BonusType, ExerciseInstanceWithCycle } from '../types/training';

type Props = NativeStackScreenProps<RootStackParamList, 'BonusPresetPicker'>;

type PresetOption = {
  id: string;
  name: string;
  itemCount: number;
  items?: ExerciseInstanceWithCycle[];
};

type BuiltinTemplate = {
  name: string;
  items: { exerciseName: string; sets: number; reps: number; weight: number; isTimeBased: boolean; isPerSide?: boolean; cycleId?: string; cycleOrder?: number }[];
};

const BUILTIN_WARMUP_TEMPLATES: Record<string, BuiltinTemplate> = {
  upper: {
    name: 'Upper',
    items: [
      { exerciseName: '90/90 Hips', sets: 1, reps: 6, weight: 0, isTimeBased: false, isPerSide: true },
      { exerciseName: 'Quadruped T-Spine Rotation', sets: 2, reps: 6, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'c1', cycleOrder: 0 },
      { exerciseName: 'Scapular Push-Ups', sets: 2, reps: 8, weight: 0, isTimeBased: false, cycleId: 'c1', cycleOrder: 1 },
      { exerciseName: 'Band External Rotation', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'c2', cycleOrder: 0 },
      { exerciseName: 'Curl Hold', sets: 3, reps: 45, weight: 0, isTimeBased: true, cycleId: 'c2', cycleOrder: 1 },
    ],
  },
  legs: {
    name: 'Legs',
    items: [
      { exerciseName: '90/90 Hips', sets: 2, reps: 6, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'c1', cycleOrder: 0 },
      { exerciseName: "World's Greatest Stretch", sets: 2, reps: 5, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'c1', cycleOrder: 1 },
      { exerciseName: 'Half-Kneeling Hip Flexor', sets: 2, reps: 30, weight: 0, isTimeBased: true, isPerSide: true, cycleId: 'c1', cycleOrder: 2 },
      { exerciseName: 'Knee-to-Wall Ankle', sets: 2, reps: 6, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'c2', cycleOrder: 0 },
      { exerciseName: 'Wall Sit', sets: 2, reps: 45, weight: 0, isTimeBased: true, cycleId: 'c2', cycleOrder: 1 },
    ],
  },
};

function resolveBuiltinItems(template: BuiltinTemplate): ExerciseInstanceWithCycle[] {
  const cycleIdMap = new Map<string, string>();
  return template.items.map(item => {
    let cycleId = item.cycleId;
    if (cycleId) {
      if (!cycleIdMap.has(cycleId)) {
        cycleIdMap.set(cycleId, `bonus-cycle-${Date.now()}-${cycleIdMap.size}`);
      }
      cycleId = cycleIdMap.get(cycleId);
    }
    return createNewExerciseItem({
      exerciseName: item.exerciseName,
      totalSets: item.sets,
      repsPerSet: item.reps,
      weightPerSet: item.weight,
      isTimeBased: item.isTimeBased,
      isPerSide: item.isPerSide,
      cycleId,
      cycleOrder: item.cycleOrder,
    });
  });
}

export function BonusPresetPickerScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { bonusType, addToProgram } = route.params;
  const {
    warmupPresets,
    corePresets,
    workoutTemplates,
    addBonusLog,
    setPendingCorePresetForProgram,
    getActiveCoreProgram,
    getUpNextCoreSession,
    getCoreCompletedCount,
    createDefaultCoreProgram,
  } = useStore();

  const title = bonusType === 'warmup' ? t('warmUp') : t('core');
  const activeProgram = bonusType === 'core' ? getActiveCoreProgram() : null;
  const upNextSession = activeProgram ? getUpNextCoreSession(activeProgram.id) : null;
  const completedCount = activeProgram ? getCoreCompletedCount(activeProgram.id) : 0;
  const totalExpected = activeProgram ? activeProgram.durationWeeks * activeProgram.sessionsPerWeekTarget : 18;
  const programFinished = activeProgram && activeProgram.currentWeekIndex > activeProgram.durationWeeks;
  const [addCoreDrawerVisible, setAddCoreDrawerVisible] = useState(false);

  const presets: PresetOption[] = useMemo(() => {
    const standalone = bonusType === 'warmup'
      ? warmupPresets.map(p => ({ id: p.id, name: p.name, itemCount: p.items.length, items: p.items }))
      : corePresets.map(p => ({ id: p.id, name: p.name, itemCount: p.items.length, items: p.items }));

    const fromTemplates = workoutTemplates
      .filter(wt => {
        const items = bonusType === 'warmup' ? wt.warmupItems : wt.accessoryItems;
        return items && items.length > 0;
      })
      .map(wt => {
        const items = (bonusType === 'warmup' ? wt.warmupItems : wt.accessoryItems) as ExerciseInstanceWithCycle[];
        return {
          id: `wt-${wt.id}`,
          name: wt.name,
          itemCount: items.length,
          items,
        };
      });

    const builtinTemplates = bonusType === 'warmup' ? BUILTIN_WARMUP_TEMPLATES : BUILTIN_CORE_TEMPLATES;
    const builtins: PresetOption[] = Object.entries(builtinTemplates).map(([key, tmpl]) => ({
      id: `builtin-${key}`,
      name: tmpl.name,
      itemCount: tmpl.items.length,
    }));

    return [...standalone, ...fromTemplates, ...builtins];
  }, [bonusType, warmupPresets, corePresets, workoutTemplates]);

  const handleSelect = async (preset: PresetOption) => {
    let items: ExerciseInstanceWithCycle[] = [];
    if (preset.items) {
      items = [...preset.items];
    } else if (preset.id.startsWith('builtin-')) {
      const key = preset.id.replace('builtin-', '');
      if (bonusType === 'warmup') {
        const tmpl = BUILTIN_WARMUP_TEMPLATES[key];
        if (tmpl) items = resolveBuiltinItems(tmpl);
      } else {
        const tmpl = BUILTIN_CORE_TEMPLATES[key];
        if (tmpl) items = resolveBuiltinCoreItems(tmpl);
      }
    }

    if (addToProgram && bonusType === 'core') {
      setPendingCorePresetForProgram({ id: preset.id, name: preset.name, items });
      navigation.goBack();
      return;
    }

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
      exercisePayload: {
        items,
        completedItems: [],
      },
    };

    await addBonusLog(log);
    navigation.goBack();
  };

  const handleCreateNew = () => {
    const editorScreen = bonusType === 'warmup' ? 'WarmupEditor' : 'AccessoriesEditor';
    (navigation as any).navigate(editorScreen, { templateId: 'new' });
  };

  const handleDelete = (preset: PresetOption) => {
    Alert.alert(
      'Delete',
      `Are you sure you want to delete "${preset.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const store = useStore.getState();
            if (bonusType === 'warmup') {
              store.deleteWarmupPreset(preset.id);
            } else {
              store.deleteCorePreset(preset.id);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={{ width: 48 }} />
          </View>

          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>{title}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {bonusType === 'core' && (
            <View style={styles.programCardSection}>
              {!activeProgram ? (
                <TouchableOpacity
                  style={[CARDS.cardDeepDimmed.outer, styles.programCard]}
                  onPress={async () => {
                    await createDefaultCoreProgram();
                    (navigation as any).navigate('CoreProgram');
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[CARDS.cardDeepDimmed.inner, styles.programCardInner]}>
                    <Text style={styles.programCardTitle}>Set up your Core Program</Text>
                    <Text style={styles.programCardMeta}>Create a program to track progress and see what's next</Text>
                    <View style={styles.programCardCta}>
                      <Text style={styles.programCardCtaText}>Create program</Text>
                      <IconArrowRight size={16} color={COLORS.accentPrimary} />
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[CARDS.cardDeepDimmed.outer, styles.programCard]}
                  onPress={() => (navigation as any).navigate('CoreProgram')}
                  activeOpacity={0.85}
                >
                  <View style={[CARDS.cardDeepDimmed.inner, styles.programCardInner]}>
                    <Text style={styles.programCardTitle}>{activeProgram.name}</Text>
                    <Text style={styles.programCardMeta}>
                      Week {activeProgram.currentWeekIndex} of {activeProgram.durationWeeks} · {completedCount}/{totalExpected} sessions
                    </Text>
                    {programFinished ? (
                      <Text style={styles.programCardUpNext}>Program complete</Text>
                    ) : upNextSession ? (
                      <Text style={styles.programCardUpNext}>Up next: {upNextSession.name}</Text>
                    ) : null}
                    <View style={styles.programCardCta}>
                      <Text style={styles.programCardCtaText}>View workouts & details</Text>
                      <IconArrowRight size={16} color={COLORS.accentPrimary} />
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {bonusType === 'core' ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setAddCoreDrawerVisible(true)}
              activeOpacity={0.7}
            >
              <DiagonalLinePattern width="100%" height={56} borderRadius={16} />
              <IconAdd size={24} color={COLORS.text} />
              <Text style={styles.addButtonText}>Add Core Workout</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.grid}>
                {presets.map(preset => (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => handleSelect(preset)}
                    onLongPress={() => {
                      if (!preset.id.startsWith('wt-')) {
                        Alert.alert(
                          preset.name,
                          'What would you like to do?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => handleDelete(preset),
                            },
                          ]
                        );
                      }
                    }}
                    activeOpacity={1}
                    style={styles.card}
                  >
                    <View style={CARDS.cardDeepDimmed.outer}>
                      <View style={[CARDS.cardDeepDimmed.inner, styles.cardInner]}>
                        <Text style={styles.cardName}>{preset.name}</Text>
                        <Text style={styles.cardMeta}>
                          {preset.itemCount} {preset.itemCount === 1 ? 'exercise' : 'exercises'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleSelect(preset)}
                          style={styles.startButton}
                          activeOpacity={1}
                        >
                          <Text style={styles.startButtonText}>{t('start')}</Text>
                          <IconPlay size={10} color={COLORS.accentPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleCreateNew}
                activeOpacity={0.7}
              >
                <DiagonalLinePattern width="100%" height={56} borderRadius={16} />
                <IconAdd size={24} color={COLORS.text} />
                <Text style={styles.addButtonText}>{`Add ${t('warmUp')}`}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {bonusType === 'core' && (
        <BottomDrawer visible={addCoreDrawerVisible} onClose={() => setAddCoreDrawerVisible(false)} maxHeight="85%">
          <View style={styles.addCoreDrawerContent}>
            <Text style={styles.addCoreDrawerTitle}>Add Core Workout</Text>
            <ScrollView style={styles.addCoreDrawerScroll} contentContainerStyle={styles.addCoreDrawerScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>
                {presets.map(preset => (
                  <TouchableOpacity
                    key={preset.id}
                    onPress={() => {
                      handleSelect(preset);
                      setAddCoreDrawerVisible(false);
                    }}
                    activeOpacity={1}
                    style={styles.card}
                  >
                    <View style={CARDS.cardDeepDimmed.outer}>
                      <View style={[CARDS.cardDeepDimmed.inner, styles.cardInner]}>
                        <Text style={styles.cardName}>{preset.name}</Text>
                        <Text style={styles.cardMeta}>
                          {preset.itemCount} {preset.itemCount === 1 ? 'exercise' : 'exercises'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            handleSelect(preset);
                            setAddCoreDrawerVisible(false);
                          }}
                          style={styles.startButton}
                          activeOpacity={1}
                        >
                          <Text style={styles.startButtonText}>{t('start')}</Text>
                          <IconPlay size={10} color={COLORS.accentPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  setAddCoreDrawerVisible(false);
                  handleCreateNew();
                }}
                activeOpacity={0.7}
              >
                <DiagonalLinePattern width="100%" height={56} borderRadius={16} />
                <IconAdd size={24} color={COLORS.text} />
                <Text style={styles.addButtonText}>Create new</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </BottomDrawer>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  pageTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
    paddingBottom: 140,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
    rowGap: SPACING.md,
  },
  card: {
    width: '48%',
  },
  cardInner: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: 24,
  },
  cardName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 4,
  },
  cardMeta: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  startButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  addButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 48,
    overflow: 'hidden',
  },
  addButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  programCardSection: {
    marginBottom: SPACING.xl,
  },
  programCard: {
    marginBottom: 0,
  },
  programCardInner: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: 24,
  },
  programCardTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 4,
  },
  programCardMeta: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: 4,
  },
  programCardUpNext: {
    ...TYPOGRAPHY.meta,
    color: COLORS.accentPrimary,
    marginBottom: 12,
  },
  programCardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  programCardCtaText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
  addCoreDrawerContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  addCoreDrawerTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  addCoreDrawerScroll: {
    maxHeight: 400,
  },
  addCoreDrawerScrollContent: {
    paddingBottom: SPACING.xl,
  },
});
