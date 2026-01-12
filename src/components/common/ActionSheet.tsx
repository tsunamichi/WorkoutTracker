import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomDrawer } from './BottomDrawer';
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

  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      maxHeight="30%"
      showHandle={false}
      expandable={false}
    >
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
    </BottomDrawer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: 24,
    paddingBottom: 24,
    gap: SPACING.md,
  },
  featuredAction: {
    flexDirection: 'row',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#C2C3C0',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  featuredActionDestructive: {
    // Border stays the same, only text/icon color changes
  },
  featuredLabel: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
  },
  featuredLabelDestructive: {
    color: '#FF3B30',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionItem: {
    flex: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#C2C3C0',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItemDestructive: {
    // Border stays the same, only text/icon color changes
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.metaBold,
    color: COLORS.text,
    textAlign: 'center',
  },
  labelDestructive: {
    color: '#FF3B30',
  },
});
