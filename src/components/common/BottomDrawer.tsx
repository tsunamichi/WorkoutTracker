import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ViewStyle, Animated, PanResponder, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BottomDrawerProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
  backgroundColor?: string;
  showHandle?: boolean;
  contentStyle?: ViewStyle;
  scrollable?: boolean;
  expandable?: boolean; // New prop to enable pull-to-expand
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
  expandable = false,
}: BottomDrawerProps) {
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;

  // Calculate height percentages
  const defaultHeightPercent = parseFloat(maxHeight.replace('%', '')) / 100;
  const expandedHeightPercent = 0.9;
  const defaultHeight = SCREEN_HEIGHT * defaultHeightPercent;
  const expandedHeight = SCREEN_HEIGHT * expandedHeightPercent;

  const heightAnim = useRef(new Animated.Value(defaultHeight)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => expandable,
      onMoveShouldSetPanResponder: (_, gestureState) => expandable && Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        // Only respond to vertical movement on the handle
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          const newHeight = isExpanded 
            ? expandedHeight - gestureState.dy 
            : defaultHeight - gestureState.dy;
          
          // Clamp between default and expanded height
          const clampedHeight = Math.max(defaultHeight, Math.min(expandedHeight, newHeight));
          heightAnim.setValue(clampedHeight);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged up more than 50px, expand. If dragged down more than 50px, collapse
        if (gestureState.dy < -50 && !isExpanded) {
          // Expand
          setIsExpanded(true);
          Animated.spring(heightAnim, {
            toValue: expandedHeight,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
          }).start();
        } else if (gestureState.dy > 50 && isExpanded) {
          // Collapse
          setIsExpanded(false);
          Animated.spring(heightAnim, {
            toValue: defaultHeight,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
          }).start();
        } else {
          // Snap back to current state
          Animated.spring(heightAnim, {
            toValue: isExpanded ? expandedHeight : defaultHeight,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

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

      <Animated.View style={[
        styles.drawerContainer, 
        expandable ? { height: heightAnim } : { maxHeight }
      ]}>
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
          {showHandle && (
            <View 
              style={styles.handleContainer}
              {...(expandable ? panResponder.panHandlers : {})}
            >
              <View style={styles.sheetHandle} />
            </View>
          )}
          
          <Content {...contentProps}>
            {children}
          </Content>
        </SafeAreaView>
      </Animated.View>
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
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 0, // SafeAreaView handles bottom padding
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  handleContainer: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMeta,
    borderRadius: 2,
  },
});

