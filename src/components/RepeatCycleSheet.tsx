import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconEdit } from './icons';
import { BottomDrawer } from './common/BottomDrawer';
import { ExpandableCalendarStrip } from './calendar/ExpandableCalendarStrip';
import { useStore } from '../store';
import dayjs from 'dayjs';
import * as Haptics from 'expo-haptics';

interface RepeatCycleSheetProps {
  visible: boolean;
  onClose: () => void;
  cycleName: string;
  weeks: number;
  workoutCount: number;
  initialDate?: Date;
  onConfirm: (startDate: string, name: string) => void;
}

export function RepeatCycleSheet({
  visible,
  onClose,
  cycleName,
  weeks,
  workoutCount,
  initialDate,
  onConfirm,
}: RepeatCycleSheetProps) {
  const [selectedDate, setSelectedDate] = useState(
    initialDate ? dayjs(initialDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')
  );
  const [name, setName] = useState(cycleName);
  const [isEditing, setIsEditing] = useState(false);

  const { scheduledWorkouts, getScheduledWorkout, getMainCompletion } = useStore();

  useEffect(() => {
    if (visible && initialDate) {
      setName(cycleName);
      setSelectedDate(dayjs(initialDate).format('YYYY-MM-DD'));
      setIsEditing(false);
    }
  }, [visible, cycleName, initialDate]);

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(selectedDate, name.trim() || cycleName);
  };

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const endDate = dayjs(selectedDate).add(weeks, 'week').subtract(1, 'day').format('YYYY-MM-DD');

  const previewRange = {
    start: selectedDate,
    end: endDate,
    color: COLORS.accentPrimaryDimmed,
  };

  return (
    <BottomDrawer visible={visible} onClose={handleClose} maxHeight="85%">
      <View style={styles.container}>
        <View style={styles.nameRow}>
          {isEditing ? (
            <TextInput
              style={styles.cycleName}
              value={name}
              onChangeText={setName}
              placeholder={cycleName}
              placeholderTextColor={COLORS.textMeta}
              returnKeyType="done"
              autoFocus
              onSubmitEditing={() => setIsEditing(false)}
              onBlur={() => setIsEditing(false)}
            />
          ) : (
            <TouchableOpacity
              style={styles.nameRowTouchable}
              onPress={() => setIsEditing(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.cycleName} numberOfLines={1}>{name}</Text>
              <IconEdit size={18} color={COLORS.textMeta} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.calendarSection}>
          <ExpandableCalendarStrip
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            cyclePlans={[]}
            scheduledWorkouts={scheduledWorkouts}
            getScheduledWorkout={getScheduledWorkout}
            getMainCompletion={getMainCompletion}
            alwaysExpanded
            showNavArrows
            previewDateRange={previewRange}
          />
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text style={styles.startButtonText}>Start Cycle</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </View>
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
  },
  nameRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cycleName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    flexShrink: 1,
  },
  calendarSection: {
    marginHorizontal: -SPACING.xxl,
    marginTop: 32,
    marginBottom: SPACING.xl,
  },
  startButton: {
    height: 56,
    backgroundColor: COLORS.accentPrimary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    ...TYPOGRAPHY.meta,
    fontWeight: 'bold',
    color: COLORS.backgroundCanvas,
  },
});
