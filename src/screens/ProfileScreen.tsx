import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, TextInput, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';
import { IconArrowLeft, IconAdd } from '../components/icons';
import dayjs from 'dayjs';

interface ProfileScreenProps {
  navigation: any;
}

type TabType = 'progress' | 'settings';

const LIGHT_COLORS = {
  secondary: '#1B1B1B',
  textMeta: '#817B77',
};

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, bodyWeightEntries, addBodyWeightEntry, sessions, clearAllHistory } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>('progress');
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [showRestTimePicker, setShowRestTimePicker] = useState(false);
  
  // Common rest time options (in seconds)
  const restTimeOptions = [30, 60, 90, 120, 150, 180, 210, 240, 300];
  
  const handleAddWeight = async () => {
    if (newWeight.trim()) {
      const entry = {
        id: Date.now().toString(),
        date: dayjs().format('YYYY-MM-DD'),
        weight: parseFloat(newWeight),
        unit: settings.useKg ? ('kg' as const) : ('lb' as const),
      };
      await addBodyWeightEntry(entry);
      setNewWeight('');
      setShowAddWeight(false);
    }
  };
  
  // Calculate workout stats
  const totalWorkouts = sessions.length;
  const thisMonth = sessions.filter(s => 
    dayjs(s.date).isAfter(dayjs().startOf('month'))
  ).length;
  
  return (
    <View style={styles.gradient}>
      <View style={styles.container}>
        {/* Header (includes topBar with back button + title) */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          {/* Back Button */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <IconArrowLeft size={24} color="#000000" />
            </TouchableOpacity>
          </View>
            
          {/* Title */}
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.titleContainer}>
                <Text style={styles.headerTitle}>Profile</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'progress' && styles.segmentActive]}
            onPress={() => setActiveTab('progress')}
            activeOpacity={1}
          >
            <Text style={[styles.segmentText, activeTab === 'progress' && styles.segmentTextActive]}>
              Progress
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeTab === 'settings' && styles.segmentActive]}
            onPress={() => setActiveTab('settings')}
            activeOpacity={1}
          >
            <Text style={[styles.segmentText, activeTab === 'settings' && styles.segmentTextActive]}>
              Settings
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {activeTab === 'progress' ? (
            /* Progress Tab */
            <>
              {/* Workout Stats */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Workout Stats</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.cardBlackShadow}>
                    <View style={styles.cardWhiteShadow}>
                      <View style={styles.statCard}>
                        <View style={styles.statCardInner}>
                          <Text style={styles.statValue}>{totalWorkouts}</Text>
                          <Text style={styles.statLabel}>Total Workouts</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.cardBlackShadow}>
                    <View style={styles.cardWhiteShadow}>
                      <View style={styles.statCard}>
                        <View style={styles.statCardInner}>
                          <Text style={styles.statValue}>{thisMonth}</Text>
                          <Text style={styles.statLabel}>This Month</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              
              {/* Body Weight */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Body Weight</Text>
                  <TouchableOpacity onPress={() => setShowAddWeight(true)}>
                    <IconAdd size={24} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                
                {bodyWeightEntries.length === 0 ? (
                  <View style={styles.cardBlackShadow}>
                    <View style={styles.cardWhiteShadow}>
                      <View style={styles.emptyState}>
                        <View style={styles.emptyStateInner}>
                          <Text style={styles.emptyText}>No weight entries yet</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.weightList}>
                    {[...bodyWeightEntries]
                      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
                      .slice(0, 10)
                      .map((entry) => (
                        <View key={entry.id} style={styles.cardBlackShadow}>
                          <View style={styles.cardWhiteShadow}>
                            <View style={styles.weightEntry}>
                              <View style={styles.weightEntryInner}>
                                <Text style={styles.weightDate}>
                                  {dayjs(entry.date).format('MMM D, YYYY')}
                                </Text>
                                <Text style={styles.weightValue}>
                                  {entry.weight} {entry.unit}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            /* Settings Tab */
            <View style={styles.settingsList}>
              {/* Use Kilograms */}
              <View style={styles.settingsListItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Use Kilograms</Text>
                  <Text style={styles.settingDescription}>
                    {settings.useKg ? 'Weights shown in kg' : 'Weights shown in lb'}
                  </Text>
                </View>
                <Switch
                  value={settings.useKg}
                  onValueChange={(value) => updateSettings({ useKg: value })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.settingsDivider} />
              
              {/* Default Rest Time */}
              <TouchableOpacity 
                style={styles.settingsListItem}
                onPress={() => setShowRestTimePicker(true)}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Default Rest Time</Text>
                  <Text style={styles.settingDescription}>
                    {Math.floor(settings.restTimerDefaultSeconds / 60)}:{(settings.restTimerDefaultSeconds % 60).toString().padStart(2, '0')} between sets
                  </Text>
                </View>
                <View style={styles.settingChevron}>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.settingsDivider} />
              
              {/* Monthly Progress Check */}
              <View style={styles.settingsListItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Monthly Progress Check</Text>
                  <Text style={styles.settingDescription}>
                    Reminder on day {settings.monthlyProgressReminderDay} of each month
                  </Text>
                </View>
                <Switch
                  value={settings.monthlyProgressReminderEnabled}
                  onValueChange={(value) => updateSettings({ monthlyProgressReminderEnabled: value })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.settingsDivider} />
              
              {/* Design System */}
              <TouchableOpacity 
                style={styles.settingsListItem}
                onPress={() => navigation.navigate('DesignSystem')}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Design System</Text>
                  <Text style={styles.settingDescription}>
                    View colors, typography, and components
                  </Text>
                </View>
                <View style={styles.settingChevron}>
                  <Text style={styles.chevronText}>›</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.settingsDivider} />
              
              {/* Clear All History */}
              <TouchableOpacity 
                style={styles.settingsListItem}
                onPress={() => {
                  Alert.alert(
                    'Clear All History',
                    'This will delete all workout history, sessions, and progress records. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Clear All', 
                        style: 'destructive',
                        onPress: async () => {
                          await clearAllHistory();
                          Alert.alert('History Cleared', 'All workout history has been deleted.');
                        }
                      }
                    ]
                  );
                }}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: '#FF3B30' }]}>Clear All History</Text>
                  <Text style={styles.settingDescription}>
                    Delete all workout records and progress
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingsListItem}
                onPress={() => {
                  Alert.alert(
                    'Reset Onboarding',
                    'This will reset the app to the welcome screen. You can test the onboarding flow again.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Reset', 
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await AsyncStorage.multiRemove(['@app/onboardingState', '@app/cycles']);
                            Alert.alert(
                              'Onboarding Reset',
                              'Please reload the app to see the welcome screen.',
                              [{ text: 'OK' }]
                            );
                          } catch (error) {
                            console.error('Failed to reset onboarding:', error);
                            Alert.alert('Error', 'Failed to reset onboarding.');
                          }
                        }
                      }
                    ]
                  );
                }}
                activeOpacity={1}
              >
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: '#FF9500' }]}>Reset Onboarding</Text>
                  <Text style={styles.settingDescription}>
                    Return to welcome screen for testing
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        
        {/* Add Weight Modal */}
        <Modal visible={showAddWeight} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Add Weight Entry</Text>
              <TextInput
                style={styles.weightInput}
                placeholder={`Weight (${settings.useKg ? 'kg' : 'lb'})`}
                placeholderTextColor={COLORS.textMeta}
                keyboardType="decimal-pad"
                value={newWeight}
                onChangeText={setNewWeight}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonSecondary]}
                  onPress={() => {
                    setShowAddWeight(false);
                    setNewWeight('');
                  }}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={handleAddWeight}
                >
                  <Text style={styles.modalButtonPrimaryText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Rest Time Picker Modal */}
        <Modal visible={showRestTimePicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Default Rest Time</Text>
              <View style={styles.restTimeOptions}>
                {restTimeOptions.map((seconds) => {
                  const minutes = Math.floor(seconds / 60);
                  const remainingSeconds = seconds % 60;
                  const timeLabel = remainingSeconds > 0 
                    ? `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
                    : `${minutes}:00`;
                  const isSelected = settings.restTimerDefaultSeconds === seconds;
                  
                  return (
                    <TouchableOpacity
                      key={seconds}
                      style={[
                        styles.restTimeOption,
                        isSelected && styles.restTimeOptionSelected
                      ]}
                      onPress={() => {
                        updateSettings({ restTimerDefaultSeconds: seconds });
                        setShowRestTimePicker(false);
                      }}
                      activeOpacity={1}
                    >
                      <Text style={[
                        styles.restTimeOptionText,
                        isSelected && styles.restTimeOptionTextSelected
                      ]}>
                        {timeLabel}
                      </Text>
                      {isSelected && (
                        <Text style={styles.restTimeCheckmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary, { marginTop: SPACING.lg }]}
                onPress={() => setShowRestTimePicker(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    backgroundColor: '#E2E3DF',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    minHeight: 48,
    paddingHorizontal: SPACING.xxl,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -4,
  },
  header: {
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  titleContainer: {
    gap: 4,
  },
  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginLeft: 0,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xxl,
    marginVertical: SPACING.lg,
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.sm,
  },
  segmentActive: {
    backgroundColor: LIGHT_COLORS.secondary,
  },
  segmentText: {
    ...TYPOGRAPHY.bodyBold,
    color: LIGHT_COLORS.secondary,
  },
  segmentTextActive: {
    color: COLORS.backgroundCanvas,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  statCardInner: {
    backgroundColor: '#E2E3DF',
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: SPACING.lg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.h1,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    textAlign: 'center',
  },
  emptyState: {
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  emptyStateInner: {
    backgroundColor: '#E2E3DF',
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: SPACING.xl,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  weightList: {
  },
  weightEntry: {
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  weightEntryInner: {
    backgroundColor: '#E2E3DF',
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: SPACING.lg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weightDate: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
  },
  weightValue: {
    ...TYPOGRAPHY.bodyBold,
    color: LIGHT_COLORS.secondary,
  },
  settingRow: {
    backgroundColor: '#E3E3DE',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  settingRowInner: {
    backgroundColor: '#E2E3DF',
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: SPACING.lg,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
    borderLeftColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: LIGHT_COLORS.secondary,
    marginBottom: 4,
  },
  settingDescription: {
    ...TYPOGRAPHY.meta,
    color: LIGHT_COLORS.secondary,
  },
  settingChevron: {
    marginLeft: SPACING.sm,
  },
  chevronText: {
    fontSize: 24,
    color: LIGHT_COLORS.secondary,
    fontWeight: '300',
  },
  settingsList: {
    marginTop: SPACING.md,
  },
  settingsListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  restTimeOptions: {
    gap: SPACING.sm,
  },
  restTimeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.backgroundCanvas,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  restTimeOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  restTimeOptionText: {
    ...TYPOGRAPHY.bodyBold,
    color: LIGHT_COLORS.secondary,
  },
  restTimeOptionTextSelected: {
    color: LIGHT_COLORS.secondary,
  },
  restTimeCheckmark: {
    fontSize: 20,
    fontWeight: '600',
    color: LIGHT_COLORS.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.canvas,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  weightInput: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.secondary,
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: COLORS.accentPrimaryLight,
    borderLeftColor: COLORS.accentPrimaryLight,
    borderBottomColor: COLORS.accentPrimaryDark,
    borderRightColor: COLORS.accentPrimaryDark,
  },
  modalButtonPrimaryText: {
    ...TYPOGRAPHY.button,
    color: LIGHT_COLORS.secondary,
  },
  modalButtonSecondary: {
    backgroundColor: COLORS.backgroundCanvas,
  },
  modalButtonSecondaryText: {
    ...TYPOGRAPHY.button,
    color: LIGHT_COLORS.secondary,
  },
  // Dual shadow styles
  cardBlackShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 2,
  },
  cardWhiteShadow: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 1,
    elevation: 1,
  },
});


