import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';

interface BottomDrawerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
  backgroundColor?: string;
  showHandle?: boolean;
  contentStyle?: ViewStyle;
  scrollable?: boolean;
}

export function BottomDrawer({
  visible,
  onClose,
  children,
  maxHeight = '80%',
  backgroundColor = COLORS.backgroundCanvas,
  showHandle = true,
  contentStyle,
  scrollable = true,
}: BottomDrawerProps) {
  const insets = useSafeAreaInsets();
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;

  if (!visible) return null;

  const Content = scrollable ? ScrollView : View;
  const contentProps = scrollable 
    ? { contentContainerStyle: contentStyle }
    : { style: contentStyle };

  return (
    <View style={styles.drawerOverlay} pointerEvents="box-none">
      {/* Backdrop overlay */}
      <TouchableOpacity
        style={styles.drawerBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={[styles.drawerContainer, { maxHeight }]}>
        <SafeAreaView
          style={[
            styles.drawerSheet,
            {
              backgroundColor,
              borderBottomLeftRadius: deviceCornerRadius,
              borderBottomRightRadius: deviceCornerRadius,
            },
          ]}
          edges={['bottom']}
        >
          {showHandle && <View style={styles.sheetHandle} />}
          
          <Content {...contentProps}>
            {children}
          </Content>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Drawer & Overlay (matching AI screen)
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  drawerContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    elevation: 10,
  },
  drawerSheet: {
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 0, // SafeAreaView handles bottom padding
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMeta,
    borderRadius: 2,
    borderCurve: 'continuous',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
});

