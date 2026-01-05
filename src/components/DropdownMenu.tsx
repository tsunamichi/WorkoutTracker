import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../constants';

const LIGHT_COLORS = {
  cardBackground: '#E3E3DE',
  text: '#161616',
  border: '#CDCABB',
};

export interface DropdownMenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface DropdownMenuProps {
  visible: boolean;
  onClose: () => void;
  items: DropdownMenuItem[];
  top?: number;
  right?: number;
  style?: ViewStyle;
}

export function DropdownMenu({ visible, onClose, items, top = 48, right = 24, style }: DropdownMenuProps) {
  if (!visible) return null;

  return (
    <>
      {/* Overlay to close menu when tapping outside */}
      <TouchableOpacity 
        style={styles.overlay} 
        onPress={onClose}
        activeOpacity={1}
      />
      {/* Dropdown */}
      <View style={[styles.dropdown, { top, right }, style]}>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && <View style={styles.divider} />}
            <TouchableOpacity 
              style={styles.item} 
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.itemText,
                item.destructive && styles.itemTextDestructive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: LIGHT_COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.xs,
    minWidth: 120,
    zIndex: 1000,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  item: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  itemText: {
    ...TYPOGRAPHY.body,
    color: LIGHT_COLORS.text,
  },
  itemTextDestructive: {
    color: '#FF3B30',
  },
  divider: {
    height: 1,
    backgroundColor: LIGHT_COLORS.border,
    marginHorizontal: SPACING.md,
  },
});

