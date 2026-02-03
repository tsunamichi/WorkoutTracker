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
import { WarmupItemEditorSheet } from '../components/WarmupItemEditorSheet';
import { AddWarmupToCycleSheet } from '../components/AddWarmupToCycleSheet';
import type { WarmupItem_DEPRECATED as WarmupItem } from '../types/training';

// Warmup Templates
const WARMUP_TEMPLATES = {
  legs: {
    name: 'Legs',
    items: [
      // Superset 1 - 2 rounds
      { exerciseName: '90/90 Hips', sets: 2, reps: 6, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'template-cycle-1', cycleOrder: 0 },
      { exerciseName: "World's Greatest Stretch", sets: 2, reps: 5, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'template-cycle-1', cycleOrder: 1 },
      { exerciseName: 'Half-Kneeling Hip Flexor', sets: 2, reps: 30, weight: 0, isTimeBased: true, isPerSide: true, cycleId: 'template-cycle-1', cycleOrder: 2 },
      // Superset 2 - 2 rounds
      { exerciseName: 'Knee-to-Wall Ankle', sets: 2, reps: 6, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'template-cycle-2', cycleOrder: 0 },
      { exerciseName: 'Wall Sit', sets: 2, reps: 45, weight: 0, isTimeBased: true, cycleId: 'template-cycle-2', cycleOrder: 1 },
    ],
  },
  upper: {
    name: 'Upper',
    items: [
      // Single exercise
      { exerciseName: '90/90 Hips', sets: 1, reps: 6, weight: 0, isTimeBased: false, isPerSide: true },
      // Superset 1 - 2 rounds
      { exerciseName: 'Quadruped T-Spine Rotation', sets: 2, reps: 6, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'template-cycle-3', cycleOrder: 0 },
      { exerciseName: 'Scapular Push-Ups', sets: 2, reps: 8, weight: 0, isTimeBased: false, cycleId: 'template-cycle-3', cycleOrder: 1 },
      // Superset 2 - 3 rounds
      { exerciseName: 'Band External Rotation', sets: 3, reps: 8, weight: 0, isTimeBased: false, isPerSide: true, cycleId: 'template-cycle-4', cycleOrder: 0 },
      { exerciseName: 'Curl Hold', sets: 3, reps: 45, weight: 0, isTimeBased: true, cycleId: 'template-cycle-4', cycleOrder: 1 },
    ],
  },
};

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RouteParams = {
  WarmupEditor: {
    templateId: string;
  };
};

export function WarmupEditorScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'WarmupEditor'>>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  const { getWorkoutTemplate, updateWorkoutTemplate, settings } = useStore();
  const useKg = settings.useKg;
  const weightUnit = useKg ? 'kg' : 'lb';
  
  const templateId = route.params?.templateId;
  const template = getWorkoutTemplate(templateId);
  
  const [warmupItems, setWarmupItems] = useState<WarmupItem[]>(
    template?.warmupItems || []
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
      warmupItems,
    });
    
    navigation.goBack();
  };

  const handleAddItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const newItem: WarmupItem = {
      id: `warmup-${Date.now()}-${Math.random()}`,
      exerciseName: '',
      sets: 1,
      reps: 10,
      weight: 0,
      isTimeBased: false,
    };
    
    setWarmupItems([...warmupItems, newItem]);
    setEditingItemId(newItem.id);
  };

  const handleEditItem = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingItemId(itemId);
  };

  const handleSaveItem = (itemId: string, updates: Partial<WarmupItem>) => {
    setWarmupItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
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
            setWarmupItems(prev => prev.filter(item => item.id !== itemId));
          },
        },
      ]
    );
  };

  const handleAddToCycle = (itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddToCycleItemId(itemId);
  };

  const handleAddItemToCycle = (itemId: string, newItem: Omit<WarmupItem, 'id'>) => {
    const targetIndex = warmupItems.findIndex(item => item.id === itemId);
    if (targetIndex === -1) return;
    
    const targetItem = warmupItems[targetIndex];
    
    // Determine cycleId and cycleOrder
    let cycleId = targetItem.cycleId;
    let cycleOrder = 0;
    
    if (!cycleId) {
      // Create new cycle
      cycleId = `warmup-cycle-${Date.now()}`;
      // Update target item to be part of the cycle
      warmupItems[targetIndex] = {
        ...targetItem,
        cycleId,
        cycleOrder: 0,
      };
      cycleOrder = 1;
    } else {
      // Find the highest cycleOrder in this cycle and add 1
      const cycleItems = warmupItems.filter(item => item.cycleId === cycleId);
      cycleOrder = Math.max(...cycleItems.map(item => item.cycleOrder ?? 0)) + 1;
    }
    
    // Create the new item with cycle info
    const newWarmupItem: WarmupItem = {
      id: `warmup-${Date.now()}-${Math.random()}`,
      ...newItem,
      cycleId,
      cycleOrder,
    };
    
    // Insert the new item right after the target
    const updatedItems = [
      ...warmupItems.slice(0, targetIndex + 1),
      newWarmupItem,
      ...warmupItems.slice(targetIndex + 1),
    ];
    
    setWarmupItems(updatedItems);
    setAddToCycleItemId(null);
  };

  const handleApplyTemplate = async (templateKey: keyof typeof WARMUP_TEMPLATES) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (!template) return;
    
    const warmupTemplate = WARMUP_TEMPLATES[templateKey];
    
    // Map template cycleIds to unique cycleIds for this instance
    const cycleIdMap = new Map<string, string>();
    
    const newItems = warmupTemplate.items.map(item => {
      let cycleId = item.cycleId;
      
      // If item has a cycleId, map it to a unique one
      if (cycleId) {
        if (!cycleIdMap.has(cycleId)) {
          cycleIdMap.set(cycleId, `warmup-cycle-${Date.now()}-${cycleIdMap.size}`);
        }
        cycleId = cycleIdMap.get(cycleId);
      }
      
      return {
        id: `warmup-${Date.now()}-${Math.random()}`,
        ...item,
        cycleId,
      };
    });
    
    // Add template items to existing warmup items
    const updatedWarmupItems = [...warmupItems, ...newItems];
    
    // Save to store
    await updateWorkoutTemplate(template.id, {
      warmupItems: updatedWarmupItems,
    });
    
    // Navigate back
    navigation.goBack();
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
          <Text style={styles.pageTitle}>{t('warmup')}</Text>
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
          <Text style={styles.sectionTitle}>Templates</Text>
          <View style={styles.templatesGrid}>
            {Object.entries(WARMUP_TEMPLATES).map(([key, template]) => (
              <TouchableOpacity
                key={key}
                onPress={() => handleApplyTemplate(key as keyof typeof WARMUP_TEMPLATES)}
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
                      onPress={() => handleApplyTemplate(key as keyof typeof WARMUP_TEMPLATES)}
                      style={styles.applyButton}
                      activeOpacity={1}
                    >
                      <Text style={styles.applyButtonText}>Apply</Text>
                      <IconPlay size={10} color={COLORS.accentPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {warmupItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('noWarmupItems')}</Text>
            <Text style={styles.emptySubtext}>
              Tap "Add Item" to add warm-up exercises
            </Text>
          </View>
        ) : (
          warmupItems.map((item, index) => {
            const isPartOfCycle = !!item.cycleId;
            const isNextInCycle = index < warmupItems.length - 1 && 
              item.cycleId && 
              warmupItems[index + 1].cycleId === item.cycleId;
            const shouldShowAddToCycle = !isPartOfCycle || !isNextInCycle;
            
            return (
              <React.Fragment key={item.id}>
                <View style={styles.warmupItemCard}>
                  <TouchableOpacity
                    style={styles.warmupItemContent}
                    onPress={() => handleEditItem(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.warmupItemHeader}>
                      <Text style={styles.warmupItemNumber}>
                        {index + 1}
                      </Text>
                      <View style={styles.warmupItemInfo}>
                        <View style={styles.warmupItemNameRow}>
                          <Text style={styles.warmupItemName}>
                            {item.exerciseName || t('exerciseName')}
                          </Text>
                          {isPartOfCycle && item.cycleOrder !== undefined && (
                            <View style={styles.cycleBadge}>
                              <Text style={styles.cycleBadgeText}>
                                {String.fromCharCode(65 + item.cycleOrder)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.warmupItemDetails}>
                          {formatWeightForLoad(item.weight || 0, useKg)} {weightUnit} • {item.sets} {item.sets === 1 ? t('set') : t('setsUnit')} × {item.reps} {item.isTimeBased ? 'sec' : 'reps'}
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
          <Text style={styles.addItemText}>{t('addWarmupItem')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Editor Sheet */}
      {editingItemId && (() => {
        const editingItem = warmupItems.find(item => item.id === editingItemId);
        if (!editingItem) return null;
        
        return (
          <WarmupItemEditorSheet
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
        const targetItem = warmupItems.find(item => item.id === addToCycleItemId);
        if (!targetItem) return null;
        
        return (
          <AddWarmupToCycleSheet
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
  warmupItemCard: {
    backgroundColor: CARDS.cardDeepDimmed.outer.backgroundColor,
    borderRadius: CARDS.cardDeepDimmed.outer.borderRadius,
    borderCurve: CARDS.cardDeepDimmed.outer.borderCurve as any,
    borderWidth: CARDS.cardDeepDimmed.outer.borderWidth,
    borderColor: CARDS.cardDeepDimmed.outer.borderColor,
    marginBottom: SPACING.md,
    overflow: CARDS.cardDeepDimmed.outer.overflow as any,
  },
  warmupItemContent: {
    ...CARDS.cardDeepDimmed.inner,
    padding: SPACING.lg,
  },
  warmupItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  warmupItemNumber: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textMeta,
    width: 32,
  },
  warmupItemInfo: {
    flex: 1,
  },
  warmupItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  warmupItemName: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  warmupItemDetails: {
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
    fontWeight: '700',
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
