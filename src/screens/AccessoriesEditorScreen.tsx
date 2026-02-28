import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useStore } from '../store';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, CARDS, BUTTONS } from '../constants';
import { IconArrowLeft, IconAdd, IconTrash, IconPlay } from '../components/icons';
import { useTranslation } from '../i18n/useTranslation';
import { formatWeightForLoad } from '../utils/weight';
import { AccessoryItemEditorSheet } from '../components/AccessoryItemEditorSheet';
import { AddAccessoryToCycleSheet } from '../components/AddAccessoryToCycleSheet';
import type { AccessoryItem } from '../types/training';
import { createNewExerciseItem, getDisplayValuesFromItem, migrateItemsArray } from '../utils/exerciseMigration';

// Accessory Templates (Core work)
const ACCESSORY_TEMPLATES = {
  dayA: {
    name: 'Day A',
    items: [
      { exerciseName: 'Ab Wheel Rollout', sets: 3, reps: 8, weight: 0, isTimeBased: false },
      { exerciseName: 'Cable Crunch', sets: 3, reps: 12, weight: 0, isTimeBased: false },
      { exerciseName: 'Dead Bug', sets: 2, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
    ],
  },
  dayB: {
    name: 'Day B',
    items: [
      { exerciseName: 'Pallof Press', sets: 3, reps: 10, weight: 0, isTimeBased: false, isPerSide: true },
      { exerciseName: 'Half-Kneeling Cable Chop', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
      { exerciseName: 'Single-Arm Farmer Hold', sets: 2, reps: 35, weight: 0, isTimeBased: true, isPerSide: true },
    ],
  },
  dayC: {
    name: 'Day C',
    items: [
      { exerciseName: 'Suitcase Carry', sets: 4, reps: 35, weight: 0, isTimeBased: true, isPerSide: true },
      { exerciseName: 'Weighted Side Plank', sets: 3, reps: 25, weight: 0, isTimeBased: true, isPerSide: true },
      { exerciseName: 'Offset Kettlebell March', sets: 2, reps: 10, weight: 0, isTimeBased: false, isPerSide: true },
    ],
  },
  dayD: {
    name: 'Day D',
    items: [
      { exerciseName: 'Long-Lever Plank', sets: 4, reps: 25, weight: 0, isTimeBased: true },
      { exerciseName: 'Cable Pulldown Crunch', sets: 3, reps: 10, weight: 0, isTimeBased: false },
      { exerciseName: 'Dead Bug (Straight-Leg)', sets: 2, reps: 6, weight: 0, isTimeBased: false, isPerSide: true },
    ],
  },
  dayE: {
    name: 'Day E',
    items: [
      { exerciseName: 'Cable Lift', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
      { exerciseName: 'Pallof Press ISO Hold', sets: 3, reps: 25, weight: 0, isTimeBased: true, isPerSide: true },
      { exerciseName: 'Single-Arm DB Carry', sets: 2, reps: 25, weight: 0, isTimeBased: true, isPerSide: true },
    ],
  },
  dayF: {
    name: 'Day F',
    items: [
      { exerciseName: 'Hanging Knee Raise', sets: 3, reps: 10, weight: 0, isTimeBased: false },
      { exerciseName: 'Decline Sit-Up', sets: 3, reps: 8, weight: 0, isTimeBased: false },
      { exerciseName: 'Side Plank Reach-Through', sets: 2, reps: 8, weight: 0, isTimeBased: false, isPerSide: true },
    ],
  },
};

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RouteParams = {
  AccessoriesEditor: {
    templateId: string;
    workoutKey?: string;
  };
};

export function AccessoriesEditorScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'AccessoriesEditor'>>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const { getWorkoutTemplate, updateWorkoutTemplate, settings } = useStore();
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  
  const templateId = route.params?.templateId;
  const workoutKey = route.params?.workoutKey;
  const template = getWorkoutTemplate(templateId);
  
  // Migrate old items to new structure on load
  const [accessoryItems, setAccessoryItems] = useState<AccessoryItem[]>(
    migrateItemsArray((template?.accessoryItems || []) as any)
  );
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addToCycleItemId, setAddToCycleItemId] = useState<string | null>(null);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Auto-save on back
    handleSave();
  };

  const handleSave = async () => {
    if (!template) return;
    
    await updateWorkoutTemplate(template.id, {
      accessoryItems,
    });
    
    navigation.goBack();
  };

  const handleAddItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const newItem = createNewExerciseItem({
      exerciseName: '',
      totalSets: 1,
      repsPerSet: 10,
      weightPerSet: 0,
      isTimeBased: false,
    });
    
    setAccessoryItems([...accessoryItems, newItem]);
    setEditingItemId(newItem.id);
  };

  const handleEditItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingItemId(itemId);
  };

  const handleSaveItem = (itemId: string, updates: any) => {
    setAccessoryItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        
        // Convert old-style updates to new structure
        const newSets = [...item.sets];
        
        // If exerciseName changed, update movementId
        if (updates.exerciseName !== undefined) {
          item = { ...item, movementId: updates.exerciseName };
        }
        
        // If mode-related fields changed
        if (updates.isTimeBased !== undefined) {
          item = { ...item, mode: updates.isTimeBased ? 'time' : 'reps' };
        }
        
        // If isPerSide changed
        if (updates.isPerSide !== undefined) {
          item = { ...item, isPerSide: updates.isPerSide };
        }
        
        // If sets count changed, add/remove set objects
        if (updates.sets !== undefined && updates.sets !== item.sets.length) {
          const targetCount = updates.sets;
          const currentCount = newSets.length;
          
          if (targetCount > currentCount) {
            // Add more sets
            const template = newSets[0] || { id: '', reps: 10, weight: 0 };
            for (let i = currentCount; i < targetCount; i++) {
              newSets.push({
                id: `${item.id}-set-${i}-${Date.now()}`,
                reps: template.reps,
                durationSec: template.durationSec,
                weight: template.weight,
              });
            }
          } else {
            // Remove excess sets
            newSets.length = targetCount;
          }
        }
        
        // Update values in all sets if reps/weight changed
        if (updates.reps !== undefined || updates.weight !== undefined) {
          newSets.forEach(set => {
            if (updates.reps !== undefined) {
              if (item.mode === 'time') {
                set.durationSec = updates.reps;
                set.reps = undefined;
              } else {
                set.reps = updates.reps;
                set.durationSec = undefined;
              }
            }
            if (updates.weight !== undefined) {
              set.weight = updates.weight > 0 ? updates.weight : undefined;
            }
          });
        }
        
        return {
          ...item,
          sets: newSets,
        };
      })
    );
    setEditingItemId(null);
  };

  const handleDeleteItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      t('deleteExerciseTitle'),
      t('deleteExerciseMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => {
            setAccessoryItems(prev => prev.filter(item => item.id !== itemId));
          },
        },
      ]
    );
  };

  const handleAddToCycle = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddToCycleItemId(itemId);
  };

  const handleAddItemToCycle = (itemId: string, newItemParams: any) => {
    const targetIndex = accessoryItems.findIndex(item => item.id === itemId);
    if (targetIndex === -1) return;
    
    const targetItem = accessoryItems[targetIndex];
    
    // Determine cycleId and cycleOrder
    let cycleId = targetItem.cycleId;
    let cycleOrder = 0;
    
    if (!cycleId) {
      // Create new cycle
      cycleId = `accessory-cycle-${Date.now()}`;
      // Update target item to be part of the cycle
      accessoryItems[targetIndex] = {
        ...targetItem,
        cycleId,
        cycleOrder: 0,
      };
      cycleOrder = 1;
    } else {
      // Find the highest cycleOrder in this cycle and add 1
      const cycleItems = accessoryItems.filter(item => item.cycleId === cycleId);
      cycleOrder = Math.max(...cycleItems.map(item => item.cycleOrder ?? 0)) + 1;
    }
    
    // Create the new item with cycle info using the helper
    const newAccessoryItem = createNewExerciseItem({
      exerciseName: newItemParams.exerciseName || '',
      totalSets: newItemParams.sets || 1,
      repsPerSet: newItemParams.reps || 10,
      weightPerSet: newItemParams.weight || 0,
      isTimeBased: newItemParams.isTimeBased || false,
      isPerSide: newItemParams.isPerSide,
      cycleId,
      cycleOrder,
    });
    
    // Insert the new item right after the target
    const updatedItems = [
      ...accessoryItems.slice(0, targetIndex + 1),
      newAccessoryItem,
      ...accessoryItems.slice(targetIndex + 1),
    ];
    
    setAccessoryItems(updatedItems);
    setAddToCycleItemId(null);
  };

  const handleApplyTemplate = async (templateKey: keyof typeof ACCESSORY_TEMPLATES) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    console.log('🎯 handleApplyTemplate called with:', templateKey);
    console.log('📝 workoutKey:', workoutKey);
    console.log('📝 templateId:', template?.id);
    
    if (!template) return;
    
    const accessoryTemplate = ACCESSORY_TEMPLATES[templateKey];
    
    // Map template cycleIds to unique cycleIds for this instance
    const cycleIdMap = new Map<string, string>();
    
    const newItems = accessoryTemplate.items.map(item => {
      let cycleId = item.cycleId;
      
      // If item has a cycleId, map it to a unique one
      if (cycleId) {
        if (!cycleIdMap.has(cycleId)) {
          cycleIdMap.set(cycleId, `accessory-cycle-${Date.now()}-${cycleIdMap.size}`);
        }
        cycleId = cycleIdMap.get(cycleId);
      }
      
      // Create using new structure
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
    
    // Replace existing accessory items with template items
    const updatedAccessoryItems = newItems;
    
    // Save to store
    await updateWorkoutTemplate(template.id, {
      accessoryItems: updatedAccessoryItems,
    });
    
    // Navigate to execution screen
    // If no workoutKey provided, generate a standalone one
    const executionWorkoutKey = workoutKey || `accessory-standalone-${Date.now()}`;
    
    console.log('🚀 Replacing with ExerciseExecution (core):', {
      workoutKey: executionWorkoutKey,
      workoutTemplateId: template.id,
    });
    
    // Replace current screen so back button goes to workout execution (not editor)
    (navigation as any).replace('ExerciseExecution', {
      workoutKey: executionWorkoutKey,
      workoutTemplateId: template.id,
      type: 'core',
    });
  };


  if (!template) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <IconArrowLeft size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.backButton} />
          </View>
          <View style={styles.pageTitleContainer}>
            <Text style={styles.pageTitle}>{t('workoutNotFound')}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <IconArrowLeft size={24} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.backButton} />
        </View>
        
        <View style={styles.pageTitleContainer}>
          <Text style={styles.pageTitle}>Core</Text>
          <Text style={styles.pageSubtitle}>{template.name}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Templates Section */}
        <View style={styles.templatesSection}>
          <Text style={styles.sectionTitle}>{t('saved')}</Text>
          <View style={styles.templatesGrid}>
            {Object.entries(ACCESSORY_TEMPLATES).map(([key, template]) => (
              <TouchableOpacity
                key={key}
                onPress={() => handleApplyTemplate(key as keyof typeof ACCESSORY_TEMPLATES)}
                activeOpacity={1}
                style={styles.templateCard}
              >
                <View style={CARDS.cardDeepDimmed.outer}>
                  <View style={[CARDS.cardDeepDimmed.inner, styles.templateCardInner]}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateCount}>
                      {template.items.length} {template.items.length === 1 ? 'exercise' : 'exercises'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleApplyTemplate(key as keyof typeof ACCESSORY_TEMPLATES)}
                      style={styles.applyButton}
                      activeOpacity={1}
                    >
                      <Text style={styles.applyButtonText}>{t('useTemplate')}</Text>
                      <IconPlay size={10} color={COLORS.accentPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {accessoryItems.length === 0 ? null : (
          accessoryItems.map((item, index) => {
            const displayValues = getDisplayValuesFromItem(item);
            const isPartOfCycle = !!item.cycleId;
            const isNextInCycle = index < accessoryItems.length - 1 && 
              item.cycleId && 
              accessoryItems[index + 1].cycleId === item.cycleId;
            const shouldShowAddToCycle = !isPartOfCycle || !isNextInCycle;
            
            return (
              <React.Fragment key={item.id}>
                <View style={styles.accessoryItemCard}>
                  <TouchableOpacity
                    style={styles.accessoryItemContent}
                    onPress={() => handleEditItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.accessoryItemHeader}>
                      <Text style={styles.accessoryItemNumber}>
                        {index + 1}
                      </Text>
                      <View style={styles.accessoryItemInfo}>
                        <View style={styles.accessoryItemNameRow}>
                          <Text style={styles.accessoryItemName}>
                            {displayValues.exerciseName || t('exerciseName')}
                          </Text>
                          {isPartOfCycle && item.cycleOrder !== undefined && (
                            <View style={styles.cycleBadge}>
                              <Text style={styles.cycleBadgeText}>
                                {String.fromCharCode(65 + item.cycleOrder)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.accessoryItemDetails}>
                          {formatWeightForLoad(displayValues.weight || 0, useKg)} {weightUnit} • {displayValues.sets} {displayValues.sets === 1 ? t('set') : t('setsUnit')} × {displayValues.reps} {displayValues.isTimeBased ? 'sec' : 'reps'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteItem(item.id)}
                        activeOpacity={0.7}
                      >
                        <IconTrash size={20} color={COLORS.error} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
                
                {/* Cycle Connector */}
                {isNextInCycle && (
                  <View style={styles.cycleConnector}>
                    <View style={styles.cycleConnectorLine} />
                    <Text style={styles.cycleConnectorText}>cycle</Text>
                  </View>
                )}
                
                {/* Add to Cycle Button */}
                {shouldShowAddToCycle && (
                  <TouchableOpacity
                    style={styles.addToCycleButton}
                    onPress={() => handleAddToCycle(item.id)}
                    activeOpacity={0.7}
                  >
                    <IconAdd size={16} color={COLORS.accentPrimary} />
                    <Text style={styles.addToCycleText}>{t('addToCycle')}</Text>
                  </TouchableOpacity>
                )}
              </React.Fragment>
            );
          })
        )}

        {/* Add Item Button */}
        <TouchableOpacity
          style={styles.addItemButton}
          onPress={handleAddItem}
          activeOpacity={1}
        >
          <IconAdd size={20} color={COLORS.text} />
          <Text style={styles.addItemText}>{t('createNew')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Editor Sheet */}
      {editingItemId && (() => {
        const editingItem = accessoryItems.find(item => item.id === editingItemId);
        if (!editingItem) return null;
        
        return (
          <AccessoryItemEditorSheet
            item={editingItem}
            visible={true}
            onClose={() => setEditingItemId(null)}
            onSave={(updates) => handleSaveItem(editingItemId, updates)}
            onDelete={() => handleDeleteItem(editingItemId)}
          />
        );
      })()}

      {/* Add to Cycle Sheet */}
      {addToCycleItemId && (() => {
        const targetItem = accessoryItems.find(item => item.id === addToCycleItemId);
        if (!targetItem) return null;
        
        return (
          <AddAccessoryToCycleSheet
            visible={true}
            onClose={() => setAddToCycleItemId(null)}
            onAdd={(newItem) => handleAddItemToCycle(addToCycleItemId, newItem)}
            cycleSets={targetItem.sets}
          />
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundCanvas,
  },
  header: {
    paddingBottom: 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xxl,
    height: 48,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: -12,
  },
  pageTitleContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.md,
    marginBottom: SPACING.xxxl + SPACING.sm,
  },
  pageTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  pageSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
  },
  emptyState: {
    paddingVertical: SPACING.xxxl * 2,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
    textAlign: 'center',
  },
  accessoryItemCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve as any,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    marginBottom: SPACING.md,
    overflow: CARDS.cardDeepDimmed.outer.overflow as any,
  },
  accessoryItemContent: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
  },
  accessoryItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  accessoryItemNumber: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMeta,
    width: 32,
  },
  accessoryItemInfo: {
    flex: 1,
  },
  accessoryItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  accessoryItemName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  accessoryItemDetails: {
    ...TYPOGRAPHY.meta,
    color: COLORS.textMeta,
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemButton: {
    width: '100%',
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.textMeta,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  addItemText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  cycleBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleBadgeText: {
    ...TYPOGRAPHY.meta,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.accentPrimary,
  },
  cycleConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    marginTop: -SPACING.md / 2,
    marginBottom: -SPACING.md / 2,
    gap: SPACING.sm,
  },
  cycleConnectorLine: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.accentPrimaryDimmed,
  },
  cycleConnectorText: {
    ...TYPOGRAPHY.meta,
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.accentPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addToCycleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.accentPrimaryDimmed,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.accentPrimary,
    borderStyle: 'dashed',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  addToCycleText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '600',
    color: COLORS.accentPrimary,
  },
  templatesSection: {
    marginBottom: SPACING.xxxl,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  templatesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
    rowGap: SPACING.md,
  },
  templateCard: {
    width: '48%',
  },
  templateCardInner: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: 24,
  },
  templateName: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    marginBottom: 4,
  },
  templateCount: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMeta,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  applyButtonText: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.accentPrimary,
  },
});
