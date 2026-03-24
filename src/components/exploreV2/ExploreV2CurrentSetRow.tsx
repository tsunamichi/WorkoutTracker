import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import type { CardPalette } from './exploreV2ColorSystem';
import { IconCheckmark } from '../icons';
import type { ExploreV2Exercise } from './exploreV2Types';

type Props = {
  palette: CardPalette;
  setIndex: number;
  exercise: ExploreV2Exercise;
  weightStr: string;
  repsStr: string;
  useKg: boolean;
  weightUnit: string;
  isCompleted: boolean;
  isNextToLog: boolean;
  isEditing: boolean;
  editingField: 'weight' | 'reps' | null;
  onTapRow: () => void;
  onFocusField: (field: 'weight' | 'reps') => void;
  onChangeWeight: (t: string) => void;
  onChangeReps: (t: string) => void;
  onBlurField: () => void;
  onCompletePress: () => void;
  weightInputRef: React.RefObject<TextInput | null>;
  repsInputRef: React.RefObject<TextInput | null>;
};

export function ExploreV2CurrentSetRow({
  palette,
  setIndex,
  exercise,
  weightStr,
  repsStr,
  useKg,
  weightUnit,
  isCompleted,
  isNextToLog,
  isEditing,
  editingField,
  onTapRow,
  onFocusField,
  onChangeWeight,
  onChangeReps,
  onBlurField,
  onCompletePress,
  weightInputRef,
  repsInputRef,
}: Props) {
  const repsLabel = exercise.isTimeBased ? 'sec' : 'reps';
  const canCheck = isNextToLog && !isCompleted;

  return (
    <TouchableOpacity
      style={[styles.row, isCompleted && styles.rowDone, isNextToLog && !isCompleted && styles.rowNext]}
      onPress={onTapRow}
      activeOpacity={0.88}
    >
      <Text style={[styles.setLabel, { color: palette.muted }]}>Set {setIndex + 1}</Text>
      <View style={styles.values}>
        {isEditing ? (
          <>
            <TextInput
              ref={weightInputRef}
              style={[styles.input, { color: palette.dark, borderBottomColor: 'rgba(18,16,24,0.12)' }]}
              value={weightStr}
              onChangeText={onChangeWeight}
              keyboardType="decimal-pad"
              selectTextOnFocus
              onFocus={() => onFocusField('weight')}
              onBlur={onBlurField}
              editable={isEditing}
            />
            <Text style={[styles.unit, { color: palette.muted }]}>{weightUnit}</Text>
            <Text style={[styles.sep, { color: palette.muted }]}>×</Text>
            <TextInput
              ref={repsInputRef}
              style={[styles.input, { color: palette.dark, borderBottomColor: 'rgba(18,16,24,0.12)' }]}
              value={repsStr}
              onChangeText={onChangeReps}
              keyboardType="number-pad"
              selectTextOnFocus
              onFocus={() => onFocusField('reps')}
              onBlur={onBlurField}
              editable={isEditing}
            />
            <Text style={[styles.unit, { color: palette.muted }]}>{repsLabel}</Text>
          </>
        ) : (
          <TouchableOpacity style={styles.valueTouch} onPress={() => onFocusField('weight')} activeOpacity={0.75}>
            <Text style={[styles.valueText, { color: palette.dark }]}>{weightStr}</Text>
            <Text style={[styles.unit, { color: palette.muted }]}>{weightUnit}</Text>
            <Text style={[styles.sep, { color: palette.muted }]}>×</Text>
            <Text style={[styles.valueText, { color: palette.dark }]}>{repsStr}</Text>
            <Text style={[styles.unit, { color: palette.muted }]}>{repsLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        style={[styles.checkBtn, !canCheck && styles.checkDisabled]}
        disabled={!canCheck}
        onPress={e => {
          e?.stopPropagation?.();
          if (canCheck) onCompletePress();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <IconCheckmark size={18} color={isCompleted ? palette.dark : palette.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(18,16,24,0.07)',
  },
  rowDone: {
    opacity: 0.55,
  },
  rowNext: {
    borderBottomColor: 'rgba(18,16,24,0.14)',
  },
  setLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 48,
    letterSpacing: 0.2,
  },
  values: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  valueTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
  },
  unit: {
    fontSize: 12,
    fontWeight: '500',
  },
  sep: {
    fontSize: 15,
    fontWeight: '500',
    marginHorizontal: 2,
  },
  input: {
    minWidth: 44,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkBtn: {
    padding: 6,
  },
  checkDisabled: {
    opacity: 0.35,
  },
});
