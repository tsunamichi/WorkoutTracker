import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, TYPOGRAPHY, COLORS } from '../../constants';

export interface ActionSheetItem {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  featured?: boolean;
  singleRow?: boolean;
  labelColor?: string;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
}

export function ActionSheet({ visible, onClose, items }: ActionSheetProps) {
  const singleRowItems = items.filter(item => item.featured || item.singleRow);
  const regularItems = items.filter(item => !item.featured && !item.singleRow);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-300)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      // Show modal first
      setModalVisible(true);
      // Then animate in
      translateY.setValue(-300);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
          velocity: 2,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      // Exit animation
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -300,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide modal after animation completes
        setModalVisible(false);
      });
    }
  }, [visible, translateY, opacity, modalVisible]);

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              paddingTop: insets.top + 8,
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.drawer}>
              <View style={styles.container}>
                {/* Single-row actions - full width, icon and label side by side */}
                {singleRowItems.map((item, index) => (
                  <TouchableOpacity
                    key={`single-${index}`}
                    style={[
                      styles.drawerItemFeatured,
                      item.destructive && styles.drawerItemDanger
                    ]}
                    onPress={() => {
                      item.onPress();
                      onClose();
                    }}
                    activeOpacity={0.85}
                    testID={index === 0 ? 'action-sheet-featured-item' : undefined}
                  >
                    <View style={styles.drawerItemIconWrap}>
                      {item.icon}
                    </View>
                    <Text
                      style={[
                        styles.drawerItemTextFeatured,
                        item.destructive && styles.drawerItemTextDanger,
                        item.labelColor ? { color: item.labelColor } : undefined
                      ]}
                      numberOfLines={1}
                      testID={item.label.includes(':') ? 'rest-timer-menu-label' : undefined}
                    >
                      {item.label || '0:00'}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Regular Actions - row of buttons, icon stacked above label */}
                {regularItems.length > 0 && (
                  <View style={styles.drawerRow}>
                    {regularItems.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.drawerItem,
                          item.destructive && styles.drawerItemDanger
                        ]}
                        onPress={() => {
                          item.onPress();
                          onClose();
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={styles.drawerItemIconWrap}>
                          {item.icon}
                        </View>
                        <Text style={[
                          styles.drawerItemText,
                          styles.drawerItemLabelWrap,
                          item.destructive && styles.drawerItemTextDanger,
                          item.labelColor ? { color: item.labelColor } : undefined
                        ]} numberOfLines={1}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContainer: {
    paddingHorizontal: SPACING.lg,
  },
  drawer: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: COLORS.activeCard,
    overflow: 'hidden' as const,
  },
  container: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  drawerRow: {
    flexDirection: 'row' as const,
    gap: SPACING.md,
  },
  drawerItem: {
    flex: 1,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: SPACING.sm,
    backgroundColor: COLORS.activeCard,
    borderRadius: 10,
    borderCurve: 'continuous' as const,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  drawerItemFeatured: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: SPACING.sm,
    height: 48,
    backgroundColor: COLORS.activeCard,
    borderRadius: 10,
    borderCurve: 'continuous' as const,
    paddingHorizontal: SPACING.lg,
  },
  drawerItemIconWrap: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  drawerItemDanger: {
    // Background stays the same; text/icon use destructive color
  },
  drawerItemText: {
    ...TYPOGRAPHY.meta,
    fontWeight: '400',
    color: COLORS.text,
    textAlign: 'center' as const,
  },
  drawerItemTextFeatured: {
    ...TYPOGRAPHY.meta,
    fontWeight: '400',
    color: COLORS.text,
    textAlign: 'center' as const,
  },
  drawerItemLabelWrap: {
    minHeight: 22,
  },
  drawerItemTextDanger: {
    color: COLORS.signalNegative,
  },
});
