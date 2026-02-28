import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, CARDS, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconAdd, IconCheckmark, IconEdit, IconMenu, IconPlay, IconRestart, IconTrash } from '../components/icons';
import { DiagonalLinePattern } from '../components/common/DiagonalLinePattern';
import { BottomDrawer } from '../components/common/BottomDrawer';
import { useTranslation } from '../i18n/useTranslation';
import { isProgramFinished, getTotalExpectedSessions, getCurrentGroup } from '../utils/coreProgram';
import { getBuiltinCoreWorkouts } from '../constants/coreTemplates';
import { CoreProgramTimeline } from '../components/core/CoreProgramTimeline';
import type { CoreSetTemplate } from '../types/training';
import type { BonusLog } from '../types/training';

const OUT_OF_ORDER_TITLE = 'Do out of order?';
const OUT_OF_ORDER_BODY = "This will log progress, but won't move your 'Up next' spot.";

export function CoreProgramScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const {
    getActiveCoreProgram,
    createDefaultCoreProgram,
    getUpNextCoreSession,
    getCoreSessionsByGroup,
    getCoreCompletedCount,
    isCoreSessionCompletedThisWeek,
    isCoreSessionSkippedThisWeek,
    addCoreSessionToProgram,
    restartCoreProgram,
    updateCoreProgram,
    deleteCoreProgram,
    corePresets,
    coreLogs,
    addBonusLog,
    pendingCorePresetForProgram,
    setPendingCorePresetForProgram,
  } = useStore();

  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addGroupSheetVisible, setAddGroupSheetVisible] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<CoreSetTemplate | null>(null);
  const [programMenuVisible, setProgramMenuVisible] = useState(false);
  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWeeks, setEditWeeks] = useState('');
  const [editSessionsPerWeek, setEditSessionsPerWeek] = useState('');

  useFocusEffect(
    React.useCallback(() => {
      if (pendingCorePresetForProgram && program) {
        const p: CoreSetTemplate = {
          id: pendingCorePresetForProgram.id,
          name: pendingCorePresetForProgram.name,
          items: pendingCorePresetForProgram.items,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastUsedAt: null,
        };
        setPendingPreset(p);
        setAddGroupSheetVisible(true);
        setPendingCorePresetForProgram(null);
      }
    }, [pendingCorePresetForProgram, program])
  );

  const program = getActiveCoreProgram();
  const upNext = program ? getUpNextCoreSession(program.id) ?? null : null;
  const { A: groupA, B: groupB } = program ? getCoreSessionsByGroup(program.id) : { A: [] as CoreSetTemplate[], B: [] as CoreSetTemplate[] };
  const completedCount = program ? getCoreCompletedCount(program.id) : 0;
  const totalExpected = program ? getTotalExpectedSessions(program) : 18;
  const finished = program ? isProgramFinished(program) : false;

  const workoutList: CoreSetTemplate[] = useMemo(
    () => [...getBuiltinCoreWorkouts(), ...(corePresets ?? [])],
    [corePresets]
  );

  // Ordered timeline sessions: program's A then B (6 total), or fallback first 6 from workout list
  const orderedSessions: CoreSetTemplate[] = useMemo(() => {
    const fromProgram = [...groupA, ...groupB];
    if (fromProgram.length > 0) return fromProgram;
    return workoutList.slice(0, 6);
  }, [groupA, groupB, workoutList]);

  // Index of the session that is "Up Next" in the timeline (0–5): first not completed and not skipped this week
  const upNextTimelineIndex = useMemo(() => {
    if (!program || finished || orderedSessions.length === 0) return 0;
    const firstIncomplete = orderedSessions.findIndex(
      s => !isCoreSessionCompletedThisWeek(program.id, s.id) && !isCoreSessionSkippedThisWeek(program.id, s.id)
    );
    return firstIncomplete >= 0 ? firstIncomplete : 0;
  }, [program, finished, orderedSessions, coreLogs, isCoreSessionCompletedThisWeek, isCoreSessionSkippedThisWeek]);

  // Cycle 1/3 Week 1/2: 2 weeks per cycle, so totalCycles = durationWeeks/2, weekInCycle is 1 or 2
  const totalCycles = program ? Math.max(1, Math.floor(program.durationWeeks / 2)) : 1;
  const currentCycle = program
    ? Math.min(Math.ceil(program.currentWeekIndex / 2), totalCycles)
    : 1;
  const weekInCycle = program ? ((program.currentWeekIndex - 1) % 2) + 1 : 1;

  const handleCreateProgram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newProgram = await createDefaultCoreProgram();
    setEditName(newProgram.name);
    setEditSheetVisible(true);
  };

  const handleRestartProgram = () => {
    if (!program) return;
    Alert.alert(
      'Restart program',
      'Reset progress and start from Week 1? Your logs will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart program', onPress: async () => {
          await restartCoreProgram(program.id);
        } },
      ]
    );
  };

  const openEditSheet = () => {
    setProgramMenuVisible(false);
    if (program) {
      setEditName(program.name);
      setEditWeeks(String(program.durationWeeks));
      setEditSessionsPerWeek(String(program.sessionsPerWeekTarget));
      setEditSheetVisible(true);
    }
  };

  const openAddToProgramFromEdit = () => {
    setEditSheetVisible(false);
    setAddSheetVisible(true);
  };

  const saveEdit = async () => {
    if (!program) return;
    const weeks = parseInt(editWeeks, 10);
    const sessions = parseInt(editSessionsPerWeek, 10);
    await updateCoreProgram(program.id, {
      name: editName.trim() || program.name,
      durationWeeks: Number.isFinite(weeks) && weeks >= 1 ? weeks : program.durationWeeks,
      sessionsPerWeekTarget: Number.isFinite(sessions) && sessions >= 1 && sessions <= 7 ? sessions : program.sessionsPerWeekTarget,
    });
    setEditSheetVisible(false);
  };

  const handleDeleteProgram = () => {
    if (!program) return;
    setProgramMenuVisible(false);
    Alert.alert(
      'Delete program',
      `Remove "${program.name}"? Workouts will stay in your library but won't be linked to a program.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCoreProgram(program.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const addBonusAndNavigate = (session: CoreSetTemplate, isUpNext: boolean) => {
    const today = dayjs().format('YYYY-MM-DD');
    const log: BonusLog = {
      id: `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: today,
      type: 'core',
      presetId: session.id,
      presetName: session.name,
      createdAt: new Date().toISOString(),
      status: 'planned',
      completedAt: null,
      exercisePayload: { items: [...session.items], completedItems: [] },
      coreProgramId: program?.id ?? null,
      coreSessionTemplateId: session.id,
    };
    addBonusLog(log);
    navigation.navigate('ExerciseExecution', {
      workoutKey: `bonus-${log.id}`,
      workoutTemplateId: session.id,
      type: 'core',
      bonusLogId: log.id,
    });
  };

  const isSessionInProgram = (session: CoreSetTemplate) =>
    groupA.some(s => s.id === session.id) || groupB.some(s => s.id === session.id);

  const handleStartSession = (session: CoreSetTemplate) => {
    if (!program) return;
    const isUpNext = upNext?.id === session.id;
    if (!isUpNext) {
      Alert.alert(
        OUT_OF_ORDER_TITLE,
        OUT_OF_ORDER_BODY,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start anyway', onPress: () => addBonusAndNavigate(session, false) },
        ]
      );
      return;
    }
    addBonusAndNavigate(session, true);
  };

  const handleStartWorkout = (session: CoreSetTemplate) => {
    if (program && isSessionInProgram(session)) {
      handleStartSession(session);
    } else {
      addBonusAndNavigate(session, false);
    }
  };

  const handleTimelineStartSession = (session: CoreSetTemplate, isUpNext: boolean) => {
    if (isUpNext) {
      addBonusAndNavigate(session, true);
      return;
    }
    Alert.alert(
      OUT_OF_ORDER_TITLE,
      OUT_OF_ORDER_BODY,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start anyway', onPress: () => addBonusAndNavigate(session, false) },
      ]
    );
  };

  const handleAddToProgram = () => {
    setAddSheetVisible(true);
  };

  const openAddGroup = (preset: CoreSetTemplate) => {
    setPendingPreset(preset);
    setAddSheetVisible(false);
    setAddGroupSheetVisible(true);
  };

  const confirmAddToGroup = async (group: 'A' | 'B') => {
    if (!program || !pendingPreset) return;
    const { A, B } = getCoreSessionsByGroup(program.id);
    const arr = group === 'A' ? A : B;
    if (arr.length >= 3) {
      Alert.alert('', group === 'A' ? 'This program already has 3 sessions in Week A. Editing comes next.' : 'This program already has 3 sessions in Week B. Editing comes next.');
      return;
    }
    await addCoreSessionToProgram(program.id, pendingPreset, group);
    setPendingPreset(null);
    setAddGroupSheetVisible(false);
  };

  const handleUseTemplate = () => {
    setAddSheetVisible(false);
    navigation.navigate('BonusPresetPicker', { bonusType: 'core', addToProgram: true });
  };

  const handleCreateNew = () => {
    setAddSheetVisible(false);
    navigation.navigate('AccessoriesEditor', { templateId: 'new' });
  };

  const renderSessionCard = (session: CoreSetTemplate, options: { isUpNext?: boolean; completed?: boolean; skipped?: boolean; onStart?: () => void }) => {
    const { isUpNext, completed, skipped, onStart } = options;
    const startHandler = onStart ?? (() => handleStartSession(session));
    return (
      <TouchableOpacity
        key={session.id}
        style={[styles.sessionCard, isUpNext && styles.sessionCardUpNext]}
        onPress={startHandler}
        activeOpacity={0.85}
      >
        <View style={[CARDS.cardDeepDimmed.outer, isUpNext && styles.sessionCardBorder]}>
          <View style={[CARDS.cardDeepDimmed.inner, styles.sessionCardInner]}>
            {isUpNext && (
              <View style={styles.upNextBadge}>
                <Text style={styles.upNextBadgeText}>UP NEXT</Text>
              </View>
            )}
            <Text style={[styles.sessionCardName, skipped && styles.sessionCardSkipped]}>{session.name}</Text>
            <View style={styles.sessionCardExercises}>
              {session.items.map(item => (
                <Text key={item.id} style={styles.sessionCardExerciseName} numberOfLines={1}>
                  {item.movementId}
                </Text>
              ))}
            </View>
            <View style={styles.sessionCardFooter}>
              {completed && <IconCheckmark size={18} color={COLORS.successBright} />}
              {skipped && <Text style={styles.skippedLabel}>Skipped</Text>}
              {!completed && !skipped && (
                <TouchableOpacity onPress={startHandler} style={styles.startCta} activeOpacity={1}>
                  <Text style={styles.startCtaText}>{t('start')}</Text>
                  <IconPlay size={10} color={COLORS.accentPrimary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!program) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Set up your Core Program</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateProgram} activeOpacity={0.7}>
            <Text style={styles.createButtonText}>Create program</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (finished) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <TouchableOpacity onPress={() => setProgramMenuVisible(true)} style={styles.headerMenuButton} hitSlop={8}>
            <IconMenu size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.finishedState}>
          <Text style={styles.finishedTitle}>Program complete</Text>
          <TouchableOpacity style={styles.restartButton} onPress={handleRestartProgram} activeOpacity={0.7}>
            <Text style={styles.restartButtonText}>Restart program</Text>
          </TouchableOpacity>
        </View>

        <BottomDrawer visible={programMenuVisible} onClose={() => setProgramMenuVisible(false)}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Program</Text>
            <View style={styles.drawerRow}>
              <TouchableOpacity style={[styles.drawerItem, styles.drawerItemStacked]} onPress={openEditSheet} activeOpacity={0.85}>
                <View style={styles.drawerItemIconWrap}>
                  <IconEdit size={24} color={COLORS.text} />
                </View>
                <Text style={styles.drawerItemText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.drawerItem, styles.drawerItemStacked]} onPress={handleRestartProgram} activeOpacity={0.85}>
                <View style={styles.drawerItemIconWrap}>
                  <IconRestart size={24} color={COLORS.text} />
                </View>
                <Text style={styles.drawerItemText}>Restart</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.drawerItem, styles.drawerItemStacked, styles.drawerItemDanger]} onPress={handleDeleteProgram} activeOpacity={0.85}>
                <View style={styles.drawerItemIconWrap}>
                  <IconTrash size={24} color={COLORS.signalNegative} />
                </View>
                <Text style={[styles.drawerItemText, { color: COLORS.signalNegative }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomDrawer>

        <BottomDrawer visible={editSheetVisible} onClose={() => setEditSheetVisible(false)}>
          <View style={styles.sheetContent}>
            <Text style={styles.sheetTitle}>Edit program</Text>
            <Text style={styles.editLabel}>Name</Text>
            <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Core Program" placeholderTextColor={COLORS.textMeta} />
            <Text style={styles.editLabel}>Duration (weeks)</Text>
            <TextInput style={styles.editInput} value={editWeeks} onChangeText={setEditWeeks} placeholder="6" keyboardType="number-pad" placeholderTextColor={COLORS.textMeta} />
            <Text style={styles.editLabel}>Sessions per week</Text>
            <TextInput style={styles.editInput} value={editSessionsPerWeek} onChangeText={setEditSessionsPerWeek} placeholder="3" keyboardType="number-pad" placeholderTextColor={COLORS.textMeta} />
            <View style={styles.drawerRow}>
              <TouchableOpacity style={[styles.drawerItem, { backgroundColor: COLORS.accentPrimary }]} onPress={saveEdit} activeOpacity={0.85}>
                <Text style={[styles.drawerItemText, { color: COLORS.backgroundCanvas }]}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={openAddToProgramFromEdit} activeOpacity={0.85}>
                <IconAdd size={20} color={COLORS.text} />
                <Text style={styles.drawerItemText}>Add to Program</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomDrawer>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerSpacer} />
        <TouchableOpacity onPress={() => setProgramMenuVisible(true)} style={styles.headerMenuButton} hitSlop={8}>
          <IconMenu size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.programHeader}>
          <View style={styles.programHeaderLeft}>
            <Text style={styles.programTitle}>Core Program</Text>
            <Text style={styles.progressInfo}>
              <Text style={styles.progressLabel}>Cycle </Text>
              <Text style={styles.progressValue}>{currentCycle}/{totalCycles}</Text>
              <Text style={styles.progressLabel}>  Week </Text>
              <Text style={styles.progressValue}>{weekInCycle}/2</Text>
            </Text>
          </View>
        </View>

        <View style={[styles.timelineContainer, { width: screenWidth }]}>
          <CoreProgramTimeline
            sessions={orderedSessions}
            upNextIndex={upNextTimelineIndex}
            sessionsPerWeek={program?.sessionsPerWeekTarget ?? 3}
            onStartSession={handleTimelineStartSession}
            isSessionCompleted={id => (program ? isCoreSessionCompletedThisWeek(program.id, id) : false)}
            isSessionSkipped={id => (program ? isCoreSessionSkippedThisWeek(program.id, id) : false)}
            startLabel={t('start')}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomDrawer visible={addSheetVisible} onClose={() => setAddSheetVisible(false)}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Add to Program</Text>
          <View style={styles.drawerRow}>
            <TouchableOpacity style={styles.drawerItem} onPress={handleUseTemplate} activeOpacity={0.85}>
              <Text style={styles.drawerItemText}>Use template</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={handleCreateNew} activeOpacity={0.85}>
              <Text style={styles.drawerItemText}>Create new</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomDrawer>

      <BottomDrawer visible={addGroupSheetVisible} onClose={() => { setAddGroupSheetVisible(false); setPendingPreset(null); }}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Add to week</Text>
          <View style={styles.drawerRow}>
            <TouchableOpacity style={styles.drawerItem} onPress={() => confirmAddToGroup('A')} activeOpacity={0.85}>
              <Text style={styles.drawerItemText}>Week A</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={() => confirmAddToGroup('B')} activeOpacity={0.85}>
              <Text style={styles.drawerItemText}>Week B</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomDrawer>

      <BottomDrawer visible={programMenuVisible} onClose={() => setProgramMenuVisible(false)}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Program</Text>
          <View style={styles.drawerRow}>
            <TouchableOpacity style={[styles.drawerItem, styles.drawerItemStacked]} onPress={openEditSheet} activeOpacity={0.85}>
              <View style={styles.drawerItemIconWrap}>
                <IconEdit size={24} color={COLORS.text} />
              </View>
              <Text style={styles.drawerItemText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.drawerItem, styles.drawerItemStacked, styles.drawerItemDanger]} onPress={handleDeleteProgram} activeOpacity={0.85}>
              <View style={styles.drawerItemIconWrap}>
                <IconTrash size={24} color={COLORS.signalNegative} />
              </View>
              <Text style={[styles.drawerItemText, { color: COLORS.signalNegative }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomDrawer>

      <BottomDrawer visible={editSheetVisible} onClose={() => setEditSheetVisible(false)}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Edit program</Text>
          <Text style={styles.editLabel}>Name</Text>
          <TextInput
            style={styles.editInput}
            value={editName}
            onChangeText={setEditName}
            placeholder="Core Program"
            placeholderTextColor={COLORS.textMeta}
          />
          <Text style={styles.editLabel}>Duration (weeks)</Text>
          <TextInput
            style={styles.editInput}
            value={editWeeks}
            onChangeText={setEditWeeks}
            placeholder="6"
            keyboardType="number-pad"
            placeholderTextColor={COLORS.textMeta}
          />
          <Text style={styles.editLabel}>Sessions per week</Text>
          <TextInput
            style={styles.editInput}
            value={editSessionsPerWeek}
            onChangeText={setEditSessionsPerWeek}
            placeholder="3"
            keyboardType="number-pad"
            placeholderTextColor={COLORS.textMeta}
          />
          <View style={styles.drawerRow}>
            <TouchableOpacity style={[styles.drawerItem, { backgroundColor: COLORS.accentPrimary }]} onPress={saveEdit} activeOpacity={0.85}>
              <Text style={[styles.drawerItemText, { color: COLORS.backgroundCanvas }]}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem} onPress={openAddToProgramFromEdit} activeOpacity={0.85}>
              <IconAdd size={20} color={COLORS.text} />
              <Text style={styles.drawerItemText}>Add to Program</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundCanvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  backButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'flex-start', marginLeft: -4 },
  headerSpacer: { flex: 1 },
  headerMenuButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'flex-end' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  programHeader: {
    marginBottom: 40,
    paddingHorizontal: SPACING.xxl,
  },
  programHeaderLeft: {},
  programTitle: { ...TYPOGRAPHY.h2, color: COLORS.text, marginBottom: 4 },
  progressInfo: {
    ...TYPOGRAPHY.body,
  },
  progressLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  progressValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  timelineContainer: { marginBottom: SPACING.md },
  section: { marginBottom: SPACING.xl },
  sectionLabel: { ...TYPOGRAPHY.h3, color: COLORS.textMeta, marginBottom: SPACING.md },
  collapsibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
  },
  collapsibleRowLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
  },
  collapsibleRowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  collapsibleRowValueText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  chevronWrap: {
    transform: [{ rotate: '0deg' }],
  },
  chevronWrapRotated: {
    transform: [{ rotate: '180deg' }],
  },
  collapsibleContent: {
    marginTop: 0,
    paddingTop: SPACING.md,
  },
  sessionCard: { marginBottom: SPACING.md },
  sessionCardUpNext: {},
  sessionCardBorder: { borderWidth: 2, borderColor: COLORS.accentPrimary },
  sessionCardInner: { paddingVertical: SPACING.lg, paddingHorizontal: 24 },
  upNextBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: COLORS.accentPrimaryDimmed,
    marginBottom: 8,
  },
  upNextBadgeText: { ...TYPOGRAPHY.meta, fontWeight: '600', color: COLORS.accentPrimary },
  sessionCardName: { ...TYPOGRAPHY.h3, color: COLORS.text, marginBottom: 8 },
  sessionCardSkipped: { opacity: 0.6 },
  sessionCardExercises: { marginBottom: 0 },
  sessionCardExerciseName: { ...TYPOGRAPHY.meta, color: COLORS.textMeta, marginBottom: 2 },
  sessionCardFooter: { marginTop: 16, flexDirection: 'row', alignItems: 'center' },
  startCta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startCtaText: { ...TYPOGRAPHY.metaBold, color: COLORS.accentPrimary },
  skippedLabel: { ...TYPOGRAPHY.meta, color: COLORS.textMeta },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xxl },
  emptyStateTitle: { ...TYPOGRAPHY.h3, color: COLORS.text, marginBottom: SPACING.xl, textAlign: 'center' },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.accentPrimary,
  },
  createButtonText: { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.backgroundCanvas },
  finishedState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xxl },
  finishedTitle: { ...TYPOGRAPHY.h3, color: COLORS.text, marginBottom: SPACING.xl, textAlign: 'center' },
  restartButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.accentPrimary,
  },
  restartButtonText: { ...TYPOGRAPHY.body, fontWeight: '600', color: COLORS.backgroundCanvas },
  sheetContent: { paddingHorizontal: SPACING.xxl, paddingTop: SPACING.lg, paddingBottom: SPACING.xxl },
  sheetTitle: { ...TYPOGRAPHY.h3, color: COLORS.text, marginBottom: SPACING.md },
  sheetRow: {
    height: 52,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.activeCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sheetRowText: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600' },
  drawerRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 8,
  },
  drawerItem: {
    flex: 1,
    backgroundColor: COLORS.activeCard,
    borderRadius: 16,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  drawerItemStacked: {
    flexDirection: 'column',
    gap: SPACING.sm,
  },
  drawerItemIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemText: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: '600', textAlign: 'center' },
  drawerItemDanger: {},
  editLabel: { ...TYPOGRAPHY.meta, color: COLORS.textMeta, marginTop: 12, marginBottom: 4 },
  editInput: {
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.activeCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
});
