import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateCycleDraftStore } from '../../store/useCreateCycleDraftStore';
import { Weekday, ExerciseBlock } from '../../types/manualCycle';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { IconAdd, IconArrowLeft, IconEdit } from '../../components/icons';
import { ExerciseEditorBottomSheet } from '../../components/manualCycle/ExerciseEditorBottomSheet';
import { useStore } from '../../store';
import { ExerciseSearchPickModal } from '../../components/workoutBuilder/ExerciseSearchPickModal';
import { useTranslation } from '../../i18n/useTranslation';
import { DraggableExerciseList, type DraggableExerciseItem } from '../../components/exercises';
import { resolveExerciseByIdOrName } from '../../utils/personalExerciseCatalog';
import type { Exercise } from '../../types';
import { useAppTheme } from '../../theme/useAppTheme';
import { getAppThemeFromStore } from '../../theme/getAppThemeFromStore';

interface CreateCycleDayEditorProps {
  navigation: any;
  route: {
    params: {
      weekday: Weekday;
    };
  };
}

export function CreateCycleDayEditor({ navigation, route }: CreateCycleDayEditorProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { weekday } = route.params;

  const { workouts, setWorkoutDayName, addExerciseToDay, removeExerciseFromDay, reorderExercises } =
    useCreateCycleDraftStore();

  const exercises = useStore(s => s.exercises);
  const ensureUserExercise = useStore(s => s.ensureUserExercise);

  const workout = workouts.find(w => w.weekday === weekday);

  const [workoutName, setWorkoutName] = useState(workout?.name || '');
  const [isEditingName, setIsEditingName] = useState(true);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseBlock | null>(null);
  const [showExerciseEditor, setShowExerciseEditor] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const nameInputRef = useRef<TextInput>(null);
  const hasFocusedInitialNameRef = useRef(false);

  useEffect(() => {
    if (!workout?.name && !hasFocusedInitialNameRef.current) {
      hasFocusedInitialNameRef.current = true;
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [workout?.name]);

  useEffect(() => {
    if (workoutName.trim()) {
      setWorkoutDayName(weekday, workoutName.trim());
    }
  }, [workoutName, weekday, setWorkoutDayName]);

  const openEditorForBlock = (block: ExerciseBlock) => {
    setSelectedExercise(block);
    setShowExerciseEditor(true);
  };

  const handlePickerSelect = (ex: Exercise) => {
    const newExercise = addExerciseToDay(weekday, ex.id, ex.name);
    setShowExercisePicker(false);
    if (newExercise) {
      openEditorForBlock(newExercise);
    }
  };

  const handleEditExercise = (exercise: ExerciseBlock) => {
    openEditorForBlock(exercise);
  };

  const handleDeleteExercise = (exerciseBlockId: string) => {
    Alert.alert(t('deleteExerciseTitle'), t('deleteExerciseMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => removeExerciseFromDay(weekday, exerciseBlockId),
      },
    ]);
  };

  const handleCloseEditor = () => {
    setSelectedExercise(null);
    setShowExerciseEditor(false);
  };

  const handleReorderExercises = (reorderedExercises: DraggableExerciseItem[]) => {
    if (!workout) return;

    const originalOrder = workout.exercises;
    const idToOriginalIndex = new Map(originalOrder.map((ex, idx) => [ex.id, idx]));

    for (let newIndex = 0; newIndex < reorderedExercises.length; newIndex++) {
      const item = reorderedExercises[newIndex];
      const originalIndex = idToOriginalIndex.get(item.id);

      if (originalIndex !== undefined && originalIndex !== newIndex) {
        reorderExercises(weekday, originalIndex, newIndex);
        break;
      }
    }
  };

  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              activeOpacity={1}
            >
              <IconArrowLeft size={24} color={themeColors.text} />
            </TouchableOpacity>
            <View style={{ width: 48 }} />
          </View>
          <TouchableOpacity
            style={styles.pageTitleContainer}
            onPress={() => setIsEditingName(true)}
            activeOpacity={1}
          >
            {isEditingName ? (
              <TextInput
                ref={nameInputRef}
                style={styles.pageTitleInput}
                value={workoutName}
                onChangeText={setWorkoutName}
                onBlur={() => setIsEditingName(false)}
                autoFocus
                placeholder={t('workoutName')}
                placeholderTextColor={themeColors.textMeta}
              />
            ) : (
              <View style={styles.pageTitleRow}>
                <Text style={styles.pageTitle}>{workoutName}</Text>
                <IconEdit size={20} color={themeColors.textMeta} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          scrollEnabled={scrollEnabled}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('exercises')}</Text>
            <DraggableExerciseList
              exercises={(workout?.exercises || []).map((exercise, index) => {
                const exerciseData = resolveExerciseByIdOrName(
                  exercises,
                  exercise.exerciseId,
                  exercise.nameSnapshot,
                );
                return {
                  id: exercise.id,
                  exerciseId: exercise.exerciseId,
                  name: exerciseData?.name ?? exercise.nameSnapshot ?? t('unknownExercise'),
                  order: index,
                };
              })}
              onReorder={handleReorderExercises}
              onEdit={id => {
                const exercise = workout?.exercises.find(ex => ex.id === id);
                if (exercise) handleEditExercise(exercise);
              }}
              onDelete={id => handleDeleteExercise(id)}
              selectedExerciseId={selectedExerciseId}
              onSelectExercise={setSelectedExerciseId}
              actionButtons={['edit', 'delete']}
              scrollEnabled={scrollEnabled}
              onScrollEnabledChange={setScrollEnabled}
            />

            <TouchableOpacity
              style={styles.addExerciseCardButton}
              onPress={() => setShowExercisePicker(true)}
              activeOpacity={1}
            >
              <IconAdd size={20} color={themeColors.text} />
              <Text style={styles.addExerciseCardText}>{t('addExercise')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <ExerciseSearchPickModal
        visible={showExercisePicker}
        exercises={exercises}
        onClose={() => setShowExercisePicker(false)}
        onSelectExercise={handlePickerSelect}
        onCreateCustom={async name => {
          const ex = await ensureUserExercise(name);
          handlePickerSelect(ex);
        }}
      />

      {selectedExercise ? (
        <ExerciseEditorBottomSheet
          weekday={weekday}
          exerciseBlock={selectedExercise}
          visible={showExerciseEditor}
          onClose={handleCloseEditor}
        />
      ) : null}
    </View>
  );
}

const themeColors = getAppThemeFromStore().colors;
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: themeColors.backgroundCanvas,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: SPACING.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: themeColors.text,
  },
  pageTitleInput: {
    ...TYPOGRAPHY.h2,
    color: themeColors.text,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.xxxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.meta,
    color: themeColors.textMeta,
    marginBottom: SPACING.lg,
  },
  addExerciseCardButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: themeColors.textMeta,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
  },
  addExerciseCardText: {
    ...TYPOGRAPHY.metaBold,
    color: themeColors.text,
  },
});
