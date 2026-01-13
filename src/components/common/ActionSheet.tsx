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
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
}

export function ActionSheet({ visible, onClose, items }: ActionSheetProps) {
  const featuredItem = items.find(item => item.featured);
  const regularItems = items.filter(item => !item.featured);
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
                {/* Featured Action */}
                {featuredItem && (
                  <TouchableOpacity
                    style={[
                      styles.featuredAction,
                      featuredItem.destructive && styles.featuredActionDestructive
                    ]}
                    onPress={() => {
                      featuredItem.onPress();
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    {featuredItem.icon}
                    <Text style={[
                      styles.featuredLabel,
                      featuredItem.destructive && styles.featuredLabelDestructive
                    ]}>
                      {featuredItem.label}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Regular Actions */}
                {regularItems.length > 0 && (
                  <View style={styles.actionsRow}>
                    {regularItems.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.actionItem,
                          item.destructive && styles.actionItemDestructive
                        ]}
                        onPress={() => {
                          item.onPress();
                          onClose();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.iconContainer}>
                          {item.icon}
                        </View>
                        <Text style={[
                          styles.label,
                          item.destructive && styles.labelDestructive
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
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  container: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 24,
    paddingBottom: 24,
    gap: SPACING.md,
  },
  featuredAction: {
    flexDirection: 'row' as const,
    backgroundColor: COLORS.activeCard,
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: SPACING.sm,
  },
  featuredActionDestructive: {
    // Background stays the same, only text/icon color changes
  },
  featuredLabel: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  featuredLabelDestructive: {
    color: '#FF3B30',
  },
  actionsRow: {
    flexDirection: 'row' as const,
    gap: SPACING.md,
  },
  actionItem: {
    flex: 1,
    backgroundColor: COLORS.activeCard,
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  actionItemDestructive: {
    // Background stays the same, only text/icon color changes
  },
  iconContainer: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
    textAlign: 'center' as const,
  },
  labelDestructive: {
    color: '#FF3B30',
  },
});
