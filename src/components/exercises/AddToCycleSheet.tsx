import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, BUTTONS } from '../../constants';
import { IconAddLine, IconMinusLine, IconSearch } from '../icons';
import { BottomDrawer } from '../common/BottomDrawer';
import { Toggle } from '../Toggle';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../../utils/weight';
import { useTranslation } from '../../i18n/useTranslation';
import { useStore } from '../../store';
import type { WorkoutTemplateExercise } from '../../types/training';
import type { Exercise } from '../../types/training';
import { useAppTheme } from '../../theme/useAppTheme';
import { getAppThemeFromStore } from '../../theme/getAppThemeFromStore';

interface AddToCycleSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (newExercise: Omit<WorkoutTemplateExercise, 'id' | 'order'>) => void;
  cycleSets: number; // Number of sets that all exercises in the cycle must have
}

export const AddToCycleSheet = ({
  visible,
  onClose,
  onAdd,
  cycleSets,
}: AddToCycleSheetProps) => {
  const { t } = useTranslation();
  const { exercises, settings } = useStore();
  const useKg = settings.useKg;
  const weightStep = useKg ? 0.5 : 5;
  const weightUnit = useKg ? 'kg' : 'lb';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState('8');
  const [weight, setWeight] = useState(0);
  const [isTimeBased, setIsTimeBased] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset state when opening
      setSearchQuery('');
      setSelectedExercise(null);
      setReps('8');
      setWeight(0);
      setIsTimeBased(false);
    }
  }, [visible]);

  const handleStepper = (field: 'reps' | 'weight', delta: number) => {
    if (field === 'reps') {
      const currentValue = parseInt(reps, 10) || 0;
      const step = isTimeBased ? 5 : 1;
      const min = isTimeBased ? 5 : 1;
      const nextValue = Math.max(min, currentValue + delta * step);
      setReps(`${nextValue}`);
    } else if (field === 'weight') {
      const currentDisplay = toDisplayWeight(weight, useKg);
      const nextDisplay = Math.max(0, currentDisplay + delta * weightStep);
      setWeight(fromDisplayWeight(nextDisplay, useKg));
    }
  };

  const handleAdd = () => {
    if (!selectedExercise) return;

    const newExercise: Omit<WorkoutTemplateExercise, 'id' | 'order'> = {
      exerciseId: selectedExercise.id,
      sets: cycleSets,
      reps: parseInt(reps, 10),
      weight: weight,
      isTimeBased,
    };

    onAdd(newExercise);
    onClose();
  };

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canAdd = selectedExercise !== null;

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="90%"
      fixedHeight={true}
      showHandle={false}
      scrollable={false}
      contentStyle={styles.drawerContent}
    >
      <View style={styles.container}>
        {!selectedExercise ? (
          // Exercise Selection View
          <>
            <View style={styles.header}>
              <Text style={styles.title}>{t('selectExercises')}</Text>
              <Text style={styles.subtitle}>
                {t('cycleSetsSyncedInfo')} ({cycleSets} {t('setsUnit')})
              </Text>
            </View>

            <View style={styles.searchContainer}>
              <IconSearch size={20} color={themeColors.textMeta} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('search')}
                placeholderTextColor={themeColors.textMeta}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>

            <ScrollView style={styles.exerciseList} bounces={false}>
              {filteredExercises.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.exerciseItem}
                  onPress={() => setSelectedExercise(exercise)}
                  activeOpacity={0.7}
                >
                  <View style={styles.exerciseItemContent}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>{exercise.primaryMuscle}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          // Configuration View
          <>
            <ScrollView contentContainerStyle={styles.content} bounces={false}>
              <View style={styles.header}>
                <Text style={styles.title}>{selectedExercise.name}</Text>
                <TouchableOpacity onPress={() => setSelectedExercise(null)}>
                  <Text style={styles.changeExerciseText}>{t('change')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.settingsContainer}>
                <View style={styles.toggleRow}>
                  <Toggle
                    label={t('timeBased')}
                    value={isTimeBased}
                    onValueChange={setIsTimeBased}
                  />
                </View>

                <View style={styles.cycleInfoBanner}>
                  <Text style={styles.cycleInfoText}>
                    {cycleSets} {t('setsUnit')} • {t('cycleSetsSyncedInfo')}
                  </Text>
                </View>

                <View style={styles.valuesCard}>
                  {/* Weight Row */}
                  <View style={styles.adjustRow}>
                    <View style={styles.adjustValue}>
                      <Text style={styles.adjustValueText}>
                        {formatWeightForLoad(weight, useKg)}
                      </Text>
                      <Text style={styles.adjustUnit}>{weightUnit}</Text>
                    </View>
                    <View style={styles.adjustButtons}>
                      <TouchableOpacity
                        style={styles.adjustButtonTapTarget}
                        onPress={() => handleStepper('weight', -1)}
                        activeOpacity={1}
                      >
                        <View style={styles.adjustButton}>
                          <View style={styles.adjustButtonInner}>
                            <IconMinusLine size={24} color={themeColors.accentPrimary} />
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
                            <IconAddLine size={24} color={themeColors.accentPrimary} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.adjustDivider} />

                  {/* Reps/Duration Row */}
                  <View style={styles.adjustRow}>
                    <View style={styles.adjustValue}>
                      <Text style={styles.adjustValueText}>{reps}</Text>
                      <Text style={styles.adjustUnit}>{isTimeBased ? 'sec' : t('repsUnit')}</Text>
                    </View>
                    <View style={styles.adjustButtons}>
                      <TouchableOpacity
                        style={styles.adjustButtonTapTarget}
                        onPress={() => handleStepper('reps', -1)}
                        activeOpacity={1}
                      >
                        <View style={styles.adjustButton}>
                          <View style={styles.adjustButtonInner}>
                            <IconMinusLine size={24} color={themeColors.accentPrimary} />
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
                            <IconAddLine size={24} color={themeColors.accentPrimary} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.addButtonContainer}>
              <TouchableOpacity
                style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
                onPress={handleAdd}
                disabled={!canAdd}
                activeOpacity={1}
              >
                <Text style={styles.addButtonText}>{t('add')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </BottomDrawer>
  );
};

const themeColors = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.borderDimmed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: themeColors.text,
    flex: 1,
  },
  subtitle: {
    ...TYPOGRAPHY.meta,
    color: themeColors.textMeta,
    marginTop: SPACING.xs,
  },
  changeExerciseText: {
    ...TYPOGRAPHY.metaBold,
    color: themeColors.accentPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    backgroundColor: themeColors.activeCard,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.borderDimmed,
  },
  searchInput: {
    ...TYPOGRAPHY.body,
    color: themeColors.text,
    flex: 1,
  },
  exerciseList: {
    flex: 1,
  },
  exerciseItem: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.borderDimmed,
  },
  exerciseItemContent: {
    gap: SPACING.xs,
  },
  exerciseName: {
    ...TYPOGRAPHY.body,
    color: themeColors.text,
  },
  exerciseMeta: {
    ...TYPOGRAPHY.meta,
    color: themeColors.textMeta,
  },
  content: {
    paddingBottom: SPACING.xl,
  },
  settingsContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
    gap: SPACING.xl,
  },
  toggleRow: {
    paddingVertical: 4,
  },
  cycleInfoBanner: {
    backgroundColor: themeColors.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  cycleInfoText: {
    ...TYPOGRAPHY.meta,
    color: themeColors.accentPrimary,
    textAlign: 'center',
  },
  valuesCard: {
    backgroundColor: themeColors.activeCard,
    borderRadius: BORDER_RADIUS.lg,
    borderCurve: 'continuous',
    padding: 24,
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
    color: themeColors.text,
  },
  adjustUnit: {
    ...TYPOGRAPHY.h1,
    color: themeColors.textMeta,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonInner: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    borderCurve: 'continuous',
    backgroundColor: themeColors.accentPrimaryDimmed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustDivider: {
    height: 1,
    backgroundColor: themeColors.borderDimmed,
    marginVertical: 16,
  },
  addButtonContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  addButton: {
    backgroundColor: themeColors.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: themeColors.backgroundCanvas,
  },
});