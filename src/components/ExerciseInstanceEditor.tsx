import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SPACING, COLORS, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconAddLine, IconMinusLine, IconClose } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { formatWeightForLoad, toDisplayWeight, fromDisplayWeight } from '../utils/weight';
import { useTranslation } from '../i18n/useTranslation';
import { useStore } from '../store';
import type { ExerciseInstance, ExerciseInstanceSet, Exercise } from '../types/training';
import * as Haptics from 'expo-haptics';

interface ExerciseInstanceEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (instance: ExerciseInstance) => void;
  movement: Exercise; // The exercise from the library
  initialInstance?: ExerciseInstance; // For editing existing instance
  context: 'workout' | 'warmup'; // Determines default mode
}

/**
 * Unified Exercise Instance Editor
 * 
 * Used for both warmup items and workout exercises.
 * - Warmup context defaults to time mode
 * - Workout context defaults to reps mode
 * - Mode can be toggled
 * - Supports multiple sets with reps/time/weight
 */
export function ExerciseInstanceEditor({
  visible,
  onClose,
  onSave,
  movement,
  initialInstance,
  context,
}: ExerciseInstanceEditorProps) {
  const { settings } = useStore();
  const { t } = useTranslation();
  const useKg = settings.useKg;
  const weightStep = useKg ? 0.5 : 5;

  // Determine initial mode
  const defaultMode = context === 'warmup' ? 'time' : 'reps';
  
  const [mode, setMode] = useState<'reps' | 'time'>(defaultMode);
  const [sets, setSets] = useState<ExerciseInstanceSet[]>([]);
  const [restSec, setRestSec] = useState<number>(context === 'warmup' ? 0 : 60);

  // Initialize from existing instance or create blank
  useEffect(() => {
    if (visible) {
      if (initialInstance) {
        setMode(initialInstance.mode);
        setSets([...initialInstance.sets]);
        setRestSec(initialInstance.restSec || (context === 'warmup' ? 0 : 60));
      } else {
        // Create new instance
        const newMode = context === 'warmup' ? 'time' : 'reps';
        setMode(newMode);
        setSets([{
          id: `set-${Date.now()}`,
          ...(newMode === 'time' ? { durationSec: 30 } : { reps: 10 }),
        }]);
        setRestSec(context === 'warmup' ? 0 : 60);
      }
    }
  }, [visible, initialInstance, context]);

  const handleModeToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMode = mode === 'reps' ? 'time' : 'reps';
    setMode(newMode);
    
    // Clear incompatible fields and set defaults
    const updatedSets = sets.map(set => ({
      id: set.id,
      weight: set.weight, // Preserve weight
      ...(newMode === 'time' ? { durationSec: 30 } : { reps: 10 }),
    }));
    setSets(updatedSets);
  };

  const handleAddSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSet: ExerciseInstanceSet = {
      id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...(mode === 'time' ? { durationSec: 30 } : { reps: 10 }),
    };
    setSets([...sets, newSet]);
  };

  const handleRemoveSet = (setId: string) => {
    if (sets.length <= 1) {
      Alert.alert(t('cannotRemoveSet'), t('atLeastOneSetRequired'));
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSets(sets.filter(s => s.id !== setId));
  };

  const handleUpdateSet = (setId: string, field: 'reps' | 'durationSec' | 'weight', value: number) => {
    setSets(sets.map(set => 
      set.id === setId ? { ...set, [field]: value } : set
    ));
  };

  const handleSave = () => {
    // Validate
    const hasInvalidSets = sets.some(set => {
      if (mode === 'reps' && (!set.reps || set.reps < 1)) return true;
      if (mode === 'time' && (!set.durationSec || set.durationSec < 1)) return true;
      return false;
    });

    if (hasInvalidSets) {
      Alert.alert(t('invalidSets'), mode === 'reps' ? t('allSetsMustHaveReps') : t('allSetsMustHaveTime'));
      return;
    }

    const instance: ExerciseInstance = {
      id: initialInstance?.id || `ei-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      movementId: movement.id,
      mode,
      sets,
      restSec: restSec > 0 ? restSec : undefined,
    };

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(instance);
    onClose();
  };

  const weightUnit = useKg ? 'kg' : 'lb';

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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{movement.name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <IconClose size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'reps' && styles.modeButtonActive]}
              onPress={() => mode !== 'reps' && handleModeToggle()}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeButtonText, mode === 'reps' && styles.modeButtonTextActive]}>
                {t('reps')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'time' && styles.modeButtonActive]}
              onPress={() => mode !== 'time' && handleModeToggle()}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeButtonText, mode === 'time' && styles.modeButtonTextActive]}>
                {t('time')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sets */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sets')}</Text>
            
            {sets.map((set, index) => (
              <View key={set.id} style={styles.setCard}>
                <View style={styles.setHeader}>
                  <Text style={styles.setNumber}>{t('set')} {index + 1}</Text>
                  {sets.length > 1 && (
                    <TouchableOpacity
                      onPress={() => handleRemoveSet(set.id)}
                      style={styles.removeSetButton}
                    >
                      <IconClose size={16} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Reps or Duration */}
                <View style={styles.setRow}>
                  <Text style={styles.setLabel}>{mode === 'reps' ? t('reps') : t('duration')}</Text>
                  <View style={styles.setControls}>
                    <TouchableOpacity
                      onPress={() => {
                        const field = mode === 'reps' ? 'reps' : 'durationSec';
                        const currentValue = (mode === 'reps' ? set.reps : set.durationSec) || 0;
                        const step = mode === 'time' ? 5 : 1;
                        const newValue = Math.max(step, currentValue - step);
                        handleUpdateSet(set.id, field, newValue);
                      }}
                      style={styles.stepperButton}
                    >
                      <IconMinusLine size={20} color={COLORS.accentPrimary} />
                    </TouchableOpacity>
                    
                    <Text style={styles.setValue}>
                      {mode === 'reps' ? (set.reps || 0) : (set.durationSec || 0)}
                      {mode === 'time' && 's'}
                    </Text>
                    
                    <TouchableOpacity
                      onPress={() => {
                        const field = mode === 'reps' ? 'reps' : 'durationSec';
                        const currentValue = (mode === 'reps' ? set.reps : set.durationSec) || 0;
                        const step = mode === 'time' ? 5 : 1;
                        const newValue = currentValue + step;
                        handleUpdateSet(set.id, field, newValue);
                      }}
                      style={styles.stepperButton}
                    >
                      <IconAddLine size={20} color={COLORS.accentPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Weight (optional) */}
                {context === 'workout' && (
                  <View style={styles.setRow}>
                    <Text style={styles.setLabel}>{t('weight')}</Text>
                    <View style={styles.setControls}>
                      <TouchableOpacity
                        onPress={() => {
                          const currentWeight = set.weight ? toDisplayWeight(set.weight, useKg) : 0;
                          const newWeight = Math.max(0, currentWeight - weightStep);
                          handleUpdateSet(set.id, 'weight', fromDisplayWeight(newWeight, useKg));
                        }}
                        style={styles.stepperButton}
                      >
                        <IconMinusLine size={20} color={COLORS.accentPrimary} />
                      </TouchableOpacity>
                      
                      <Text style={styles.setValue}>
                        {set.weight ? formatWeightForLoad(set.weight, useKg) : '0'} {weightUnit}
                      </Text>
                      
                      <TouchableOpacity
                        onPress={() => {
                          const currentWeight = set.weight ? toDisplayWeight(set.weight, useKg) : 0;
                          const newWeight = currentWeight + weightStep;
                          handleUpdateSet(set.id, 'weight', fromDisplayWeight(newWeight, useKg));
                        }}
                        style={styles.stepperButton}
                      >
                        <IconAddLine size={20} color={COLORS.accentPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.addSetButton} onPress={handleAddSet}>
              <IconAddLine size={20} color={COLORS.accentPrimary} />
              <Text style={styles.addSetButtonText}>{t('addSet')}</Text>
            </TouchableOpacity>
          </View>

          {/* Rest Time (optional, mainly for workouts) */}
          {context === 'workout' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('restBetweenSets')}</Text>
              <View style={styles.setRow}>
                <Text style={styles.setLabel}>{t('seconds')}</Text>
                <View style={styles.setControls}>
                  <TouchableOpacity
                    onPress={() => setRestSec(Math.max(0, restSec - 15))}
                    style={styles.stepperButton}
                  >
                    <IconMinusLine size={20} color={COLORS.accentPrimary} />
                  </TouchableOpacity>
                  
                  <Text style={styles.setValue}>{restSec}s</Text>
                  
                  <TouchableOpacity
                    onPress={() => setRestSec(restSec + 15)}
                    style={styles.stepperButton}
                  >
                    <IconAddLine size={20} color={COLORS.accentPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Save Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{t('save')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  drawerContent: {
    paddingBottom: 0,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderDimmed,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    flex: 1,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  modeButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  modeButtonActive: {
    backgroundColor: COLORS.accentPrimary,
  },
  modeButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textMeta,
  },
  modeButtonTextActive: {
    color: COLORS.backgroundCanvas,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  setCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  setNumber: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  removeSetButton: {
    padding: SPACING.xs,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  setLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  setControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.backgroundCanvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setValue: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    minWidth: 60,
    textAlign: 'center',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  addSetButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.accentPrimary,
    marginLeft: SPACING.xs,
  },
  footer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderDimmed,
  },
  saveButton: {
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  saveButtonText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.backgroundCanvas,
  },
});
