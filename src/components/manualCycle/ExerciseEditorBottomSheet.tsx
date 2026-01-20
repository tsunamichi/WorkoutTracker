import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { useStore } from '../../store';
import { ExerciseBlock, Weekday, ExerciseWeekPlan } from '../../types/manualCycle';
import { SPACING, COLORS, TYPOGRAPHY, BORDER_RADIUS } from '../../constants';
import { IconAddLine, IconMinusLine } from '../icons';
import { BottomDrawer } from '../common/BottomDrawer';
import { Toggle } from '../Toggle';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../../utils/weight';
import { useTranslation } from '../../i18n/useTranslation';

interface ExerciseEditorBottomSheetProps {
  weekday: Weekday;
  exerciseBlock: ExerciseBlock;
  visible: boolean;
  onClose: () => void;
}

export const ExerciseEditorBottomSheet = ({
  weekday,
  exerciseBlock,
  visible,
  onClose,
}: ExerciseEditorBottomSheetProps) => {
  const { exercises: exerciseLibrary, settings } = useStore();
  const { weeks, workouts, updateExerciseWeekPlan } =
    useCreateCycleDraftStore();
  const { t } = useTranslation();

  const liveExerciseBlock = useMemo(() => {
    return (
      workouts
        .find((dayWorkout) => dayWorkout.weekday === weekday)
        ?.exercises.find((exercise) => exercise.id === exerciseBlock.id) || exerciseBlock
    );
  }, [exerciseBlock, weekday, workouts]);

  const exerciseData = exerciseLibrary.find((e) => e.id === liveExerciseBlock.exerciseId);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabActiveAnims = useRef<Animated.Value[]>([]);
  const initializedWeeksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (selectedWeekIndex >= weeks) {
      setSelectedWeekIndex(Math.max(0, weeks - 1));
    }
  }, [selectedWeekIndex, weeks]);

  useEffect(() => {
    if (!visible) return;
    setSelectedWeekIndex(0);
    tabActiveAnims.current.forEach((anim, index) => {
      anim.setValue(index === 0 ? 1 : 0);
    });
  }, [visible]);

  useEffect(() => {
    if (tabActiveAnims.current.length !== weeks) {
      tabActiveAnims.current = Array.from({ length: weeks }).map((_, index) => {
        return new Animated.Value(index === selectedWeekIndex ? 1 : 0);
      });
      return;
    }
    Animated.parallel(
      tabActiveAnims.current.map((anim, index) =>
        Animated.timing(anim, {
          toValue: index === selectedWeekIndex ? 1 : 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        })
      )
    ).start();
  }, [selectedWeekIndex, weeks]);

  const currentWeek = liveExerciseBlock.weeks[selectedWeekIndex] || {};
  const isTimeBased = currentWeek.isTimeBased || false;
  useEffect(() => {
    const key = `${liveExerciseBlock.id}:${selectedWeekIndex}`;
    if (initializedWeeksRef.current.has(key)) return;
    const needsDefaults = currentWeek.sets == null || currentWeek.reps == null;
    if (!needsDefaults) return;
    initializedWeeksRef.current.add(key);
    updateExerciseWeekPlan(weekday, liveExerciseBlock.id, selectedWeekIndex, {
      sets: currentWeek.sets ?? 3,
      reps: currentWeek.reps ?? (currentWeek.isTimeBased ? '30' : '8'),
      isTimeBased: currentWeek.isTimeBased ?? false,
    });
  }, [currentWeek, liveExerciseBlock.id, selectedWeekIndex, updateExerciseWeekPlan, weekday]);
  const useKg = settings.useKg;
  const weightStep = useKg ? 0.5 : 5;

  const handleUpdateField = useCallback(
    (field: keyof ExerciseWeekPlan, value: any) => {
      updateExerciseWeekPlan(weekday, exerciseBlock.id, selectedWeekIndex, {
        [field]: value,
      });
    },
    [
      weekday,
      exerciseBlock.id,
      updateExerciseWeekPlan,
      selectedWeekIndex,
    ]
  );

  const handleStepper = (field: 'sets' | 'reps' | 'weight', delta: number) => {
    if (field === 'reps') {
      const currentValue =
        parseInt(currentWeek.reps || (isTimeBased ? '30' : '8'), 10) || 0;
      const step = isTimeBased ? 5 : 1;
      const min = isTimeBased ? 5 : 1;
      const nextValue = Math.max(min, currentValue + delta * step);
      handleUpdateField('reps', `${nextValue}`);
      return;
    }

    if (field === 'sets') {
      const currentValue = (currentWeek.sets as number) || 3;
      const nextValue = Math.max(1, currentValue + delta);
      handleUpdateField('sets', nextValue);
      return;
    }

    const currentValue = (currentWeek.weight as number) || 0;
    const nextDisplay = Math.max(
      0,
      toDisplayWeight(currentValue, useKg) + delta * weightStep
    );
    handleUpdateField('weight', fromDisplayWeight(nextDisplay, useKg));
  };

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
      fixedHeight={true}
      bottomOffset={8}
      showHandle={false}
      scrollable={false}
      contentStyle={styles.drawerContent}
    >
      <View style={styles.sheetContainer}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{exerciseData?.name || t('unknownExercise')}</Text>
          </View>

          <View style={styles.settingsContainer}>
            <View style={styles.toggleRow}>
              <Toggle
                label={t('timeBased')}
                value={isTimeBased}
                onValueChange={(value) => handleUpdateField('isTimeBased', value)}
              />
            </View>
            <View style={styles.weekCard}>
              <View
                style={styles.weekTabs}
                onLayout={(event) => setTabsWidth(event.nativeEvent.layout.width)}
              >
                {Array.from({ length: weeks }).map((_, index) => {
                  const isActive = index === selectedWeekIndex;
                  return (
                  <TouchableOpacity
                      key={`week-tab-${index}`}
                    style={[
                      styles.weekTab,
                      !isActive && styles.weekTabInactive,
                      isActive && styles.weekTabActive,
                    ]}
                      onPress={() => setSelectedWeekIndex(index)}
                      activeOpacity={1}
                    >
                      <Animated.View
                        style={[
                          styles.weekTabActiveOverlay,
                          { opacity: tabActiveAnims.current[index] || 0 },
                        ]}
                      />
                      {isActive && (
                        <>
                          <View style={styles.weekTabCornerLeft} />
                          <View style={styles.weekTabCornerRight} />
                        </>
                      )}
                      <Text style={styles.weekTabText}>
                        {t('weekShort').replace('{number}', String(index + 1))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.valuesCard}>
                <View style={styles.adjustRow}>
                  <View style={styles.adjustValue}>
                    <Text style={styles.adjustValueText}>
                      {formatWeightForLoad(currentWeek.weight || 0, useKg)}
                    </Text>
                    <Text style={styles.adjustUnit}>{useKg ? 'kg' : 'lb'}</Text>
                  </View>
                  <View style={styles.adjustButtons}>
                    <TouchableOpacity
                      style={styles.adjustButtonTapTarget}
                      onPress={() => handleStepper('weight', -1)}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconMinusLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adjustButtonTapTarget}
                      onPress={() => handleStepper('weight', 1)}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconAddLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.adjustDivider} />

                <View style={styles.adjustRow}>
                  <View style={styles.adjustValue}>
                    <Text style={styles.adjustValueText}>
                      {currentWeek.reps || (isTimeBased ? '30' : '8')}
                    </Text>
                    <Text style={styles.adjustUnit}>{isTimeBased ? 'sec' : 'reps'}</Text>
                  </View>
                  <View style={styles.adjustButtons}>
                    <TouchableOpacity
                      style={styles.adjustButtonTapTarget}
                      onPress={() => handleStepper('reps', -1)}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconMinusLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adjustButtonTapTarget}
                      onPress={() => handleStepper('reps', 1)}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconAddLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.adjustDivider} />

                <View style={styles.adjustRow}>
                  <View style={styles.adjustValue}>
                    <Text style={styles.adjustValueText}>{currentWeek.sets || 3}</Text>
                    <Text style={styles.adjustUnit}>{t('setsUnit')}</Text>
                  </View>
                  <View style={styles.adjustButtons}>
                    <TouchableOpacity
                      style={styles.adjustButtonTapTarget}
                      onPress={() => handleStepper('sets', -1)}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconMinusLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adjustButtonTapTarget}
                      onPress={() => handleStepper('sets', 1)}
                      activeOpacity={1}
                    >
                      <View style={styles.adjustButton}>
                        <View style={styles.adjustButtonInner}>
                          <IconAddLine size={24} color={COLORS.accentPrimary} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={onClose}
            activeOpacity={1}
          >
            <Text style={styles.saveButtonText}>{t('save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomDrawer>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  sheetContainer: {
    flex: 1,
  },
  content: {
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
  },
  settingsContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
  },
  weekCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderCurve: 'continuous',
    padding: 0,
  },
  valuesCard: {
    backgroundColor: COLORS.activeCard,
    borderBottomLeftRadius: BORDER_RADIUS.lg,
    borderBottomRightRadius: BORDER_RADIUS.lg,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderCurve: 'continuous',
    padding: 24,
  },
  toggleRow: {
    marginBottom: SPACING.xl,
  },
  weekTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.full,
    borderCurve: 'continuous',
    padding: 0,
    gap: 4,
    marginBottom: 0,
    position: 'relative',
    overflow: 'visible',
    flexWrap: 'nowrap',
    width: '100%',
  },
  weekTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderCurve: 'continuous',
    zIndex: 1,
    overflow: 'visible',
  },
  weekTabActive: {},
  weekTabInactive: {
    backgroundColor: COLORS.borderDimmed,
  },
  weekTabText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  weekTabActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.activeCard,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderCurve: 'continuous',
  },
  weekTabCornerLeft: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    width: 8,
    height: 8,
    backgroundColor: COLORS.signalNegative,
    borderTopLeftRadius: 8,
    zIndex: 3,
  },
  weekTabCornerRight: {
    position: 'absolute',
    bottom: -8,
    right: 0,
    width: 8,
    height: 8,
    backgroundColor: COLORS.signalNegative,
    borderTopRightRadius: 8,
    zIndex: 3,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adjustValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  adjustValueText: {
    ...TYPOGRAPHY.h1,
    color: COLORS.text,
  },
  adjustUnit: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textMeta,
  },
  adjustButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  adjustButtonTapTarget: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    overflow: 'visible',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonInner: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    backgroundColor: COLORS.accentPrimaryDimmed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustDivider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
    marginVertical: 16,
  },
  saveButtonContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  saveButton: {
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
});

