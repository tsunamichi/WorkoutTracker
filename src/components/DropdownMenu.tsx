import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants';

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
}

export function DropdownMenu({ visible, onClose, items, top = 48, right = 18 }: DropdownMenuProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.menuContainer, { paddingTop: top }]}>
          <View style={[styles.menu, { marginRight: right }]}>
            {items.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <View style={styles.divider} />}
                <TouchableOpacity 
                  style={styles.item} 
                  onPress={item.onPress}
                  activeOpacity={1}
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
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    alignItems: 'flex-end',
  },
  menu: {
    backgroundColor: COLORS.backgroundCanvas,
    borderRadius: 12,
    borderCurve: 'continuous',
    minWidth: 160,
    overflow: 'hidden',
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  itemTextDestructive: {
    color: COLORS.signalNegative,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderDimmed,
  },
});

