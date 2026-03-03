import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconTriangle, IconAdd } from '../components/icons';
import { Toggle } from '../components/Toggle';
import { addFakeProgressionLogs } from '../utils/addFakeHistory';
import type { ProgressionGroup } from '../types/progression';

const DEFAULT_PROGRESSION = {
  repRangeMin: 8,
  repRangeMax: 12,
  weightIncrement: 2.5,
  progressionMode: 'double' as const,
};

export function ProgressionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    settings,
    updateSettings,
    progressionGroups,
    progressionDefaults,
    addProgressionGroup,
  } = useStore();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const autoProgressionEnabled = settings.progressionSuggestionsEnabled !== false;
  const defaults = progressionDefaults ?? DEFAULT_PROGRESSION;

  const handleAddGroup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const orderIndex = progressionGroups.length;
    const newGroup: ProgressionGroup = {
      id: `pg-${Date.now()}`,
      name: 'New group',
      orderIndex,
      repRangeMin: defaults.repRangeMin,
      repRangeMax: defaults.repRangeMax,
      weightIncrement: defaults.weightIncrement,
      progressionMode: defaults.progressionMode,
      exerciseIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await addProgressionGroup(newGroup);
    navigation.navigate('ProgressionGroupDetail' as never, { groupId: newGroup.id } as never);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <IconArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageTitleContainer}>
          <Text style={styles.pageTitle}>Progression rules</Text>
        </View>

        {/* Auto-progression toggle */}
        <View style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-progression</Text>
              <Text style={styles.settingDescription}>
                Automatically update weight and reps based on your last performance
              </Text>
            </View>
            <Toggle
              value={autoProgressionEnabled}
              onValueChange={(value) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateSettings({ progressionSuggestionsEnabled: value });
              }}
            />
          </View>
        </View>

        {/* Defaults card */}
        <TouchableOpacity
          style={styles.settingCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('ProgressionDefaults' as never);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Defaults</Text>
              <Text style={styles.settingDescription}>
                Global rep range, weight increment, and progression mode
              </Text>
            </View>
            <View style={{ transform: [{ rotate: '90deg' }] }}>
              <IconTriangle size={12} color={COLORS.text} />
            </View>
          </View>
        </TouchableOpacity>

        {/* Groups section */}
        <Text style={styles.sectionLabel}>Groups</Text>
        <Text style={styles.sectionDescription}>
          Assign exercises to groups to share rep ranges and progression rules.
        </Text>
        {progressionGroups
          .slice()
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.settingCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('ProgressionGroupDetail' as never, { groupId: group.id } as never);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{group.name}</Text>
                  <Text style={styles.settingDescription}>
                    {group.exerciseIds.length} exercise{group.exerciseIds.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{ transform: [{ rotate: '90deg' }] }}>
                  <IconTriangle size={12} color={COLORS.text} />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        <TouchableOpacity
          style={[styles.settingCard, styles.addGroupCard]}
          onPress={handleAddGroup}
          activeOpacity={0.7}
        >
          <View style={styles.settingRow}>
            <IconAdd size={20} color={COLORS.primary} />
            <Text style={styles.addGroupLabel}>Add group</Text>
          </View>
        </TouchableOpacity>

        {/* Debug: seed fake logs */}
        {__DEV__ && (
          <TouchableOpacity
            style={styles.debugButton}
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              await addFakeProgressionLogs();
              Alert.alert('Done', 'Bench Press fake log seeded: 185 lb × 6 reps × 3 sets. Other exercises use their real logs.');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.debugButtonLabel}>Seed test progression logs</Text>
          </TouchableOpacity>
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
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -12,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.xxl, paddingBottom: SPACING.xxxl },
  pageTitleContainer: {
    paddingTop: SPACING.md,
    marginBottom: SPACING.xxxl + SPACING.sm,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
  },
  settingCard: {
    backgroundColor: COLORS.activeCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: { flex: 1, marginRight: SPACING.md },
  settingLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  settingDescription: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  sectionLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  sectionDescription: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
    marginBottom: SPACING.lg,
  },
  addGroupCard: { borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.border },
  addGroupLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  debugButton: {
    marginTop: SPACING.xxxl,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.activeCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  debugButtonLabel: {
    ...TYPOGRAPHY.meta,
    color: COLORS.warning,
  },
});
