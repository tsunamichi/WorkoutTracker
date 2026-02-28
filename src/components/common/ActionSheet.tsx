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
  labelColor?: string;
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
                {/* Featured Action - full width, icon stacked above label */}
                {featuredItem && (
                  <TouchableOpacity
                    style={[
                      styles.drawerItem,
                      featuredItem.destructive && styles.drawerItemDanger
                    ]}
                    onPress={() => {
                      featuredItem.onPress();
                      onClose();
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.drawerItemIconWrap}>
                      {featuredItem.icon}
                    </View>
                    <Text style={[
                      styles.drawerItemText,
                      featuredItem.destructive && styles.drawerItemTextDanger
                    ]} numberOfLines={1}>
                      {featuredItem.label}
                    </Text>
                  </TouchableOpacity>
                )}

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
    borderRadius: 16,
    borderCurve: 'continuous' as const,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  drawerItemIconWrap: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  drawerItemDanger: {
    // Background stays the same; text/icon use destructive color
  },
  drawerItemText: {
    ...TYPOGRAPHY.body,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center' as const,
  },
  drawerItemTextDanger: {
    color: COLORS.signalNegative,
  },
});
