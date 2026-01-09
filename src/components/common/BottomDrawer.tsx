import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  const [contentHeight, setContentHeight] = useState(0);
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;

  // Calculate height percentages
  const maxHeightPercent = parseFloat(maxHeight.replace('%', '')) / 100;
  const expandedHeightPercent = 0.9;
  const maxHeightValue = SCREEN_HEIGHT * maxHeightPercent;
  const expandedHeight = SCREEN_HEIGHT * expandedHeightPercent;

  const translateY = useRef(new Animated.Value(0)).current;
  const maxHeightAnim = useRef(new Animated.Value(maxHeightValue)).current;
  
  // Check if content is tall enough to need expansion (add some buffer for handle and padding)
  const needsExpansion = expandable && contentHeight > maxHeightValue * 0.95;

  // Reset expanded state when drawer visibility changes
  useEffect(() => {
    if (visible) {
      setIsExpanded(false);
      translateY.setValue(0);
      maxHeightAnim.setValue(maxHeightValue);
    } else {
      setContentHeight(0);
    }
  }, [visible, maxHeightValue]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => needsExpansion,
      onMoveShouldSetPanResponder: (_, gestureState) => needsExpansion && Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging if content needs expansion
        if (!needsExpansion) return;
        
        // Allow dragging in both directions
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          if (isExpanded) {
            // When expanded, allow dragging down to collapse (positive dy only)
            if (gestureState.dy > 0) {
              translateY.setValue(gestureState.dy);
            }
          } else {
            // When collapsed, allow dragging up to expand (negative dy) or down to dismiss (positive dy)
            translateY.setValue(gestureState.dy);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50 && !isExpanded) {
          // Expand: dragged up from initial state
          setIsExpanded(true);
          translateY.setValue(0);
          Animated.spring(maxHeightAnim, {
            toValue: expandedHeight,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
          }).start();
        } else if (gestureState.dy > 50 && isExpanded) {
          // Collapse: dragged down from expanded state
          setIsExpanded(false);
          translateY.setValue(0);
          Animated.spring(maxHeightAnim, {
            toValue: maxHeightValue,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
          }).start();
        } else if (gestureState.dy > 100 && !isExpanded) {
          // Dismiss: dragged down significantly from initial state
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
          // Snap back to current state
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    }),
    [needsExpansion, isExpanded, translateY, maxHeightAnim, expandedHeight, maxHeightValue, onClose]
  );

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
        expandable ? {
          maxHeight: maxHeightAnim,
          transform: [{ translateY }],
        } : {
          maxHeight: maxHeight,
        }
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
              {...(needsExpansion ? panResponder.panHandlers : {})}
            >
              <View style={styles.sheetHandle} />
            </View>
          )}
          
          <Content {...contentProps}>
            <View
              onLayout={(event) => {
                if (expandable) {
                  const { height } = event.nativeEvent.layout;
                  console.log('📏 Drawer content height:', height, 'maxHeight:', maxHeightValue, 'needsExpansion:', height > maxHeightValue * 0.95);
                  setContentHeight(height);
                }
              }}
            >
              {children}
            </View>
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
    flexShrink: 1,
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

