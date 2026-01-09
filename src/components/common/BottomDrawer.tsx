import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ViewStyle, Animated, PanResponder, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
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
  const hasTriggeredExpansion = useRef(false);
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;

  // Calculate height percentages
  const maxHeightPercent = parseFloat(maxHeight.replace('%', '')) / 100;
  const expandedHeightPercent = 0.9;
  const maxHeightValue = SCREEN_HEIGHT * maxHeightPercent;
  const expandedHeight = SCREEN_HEIGHT * expandedHeightPercent;

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  
  // Check if content is tall enough to need expansion (add some buffer for handle and padding)
  const needsExpansion = expandable && contentHeight > maxHeightValue * 0.95;
  
  // Calculate current max height based on expanded state
  const currentMaxHeight = isExpanded ? expandedHeight : maxHeightValue;

  // Animate in/out when drawer visibility changes
  useEffect(() => {
    if (visible) {
      setIsExpanded(false);
      hasTriggeredExpansion.current = false;
      
      // Animate drawer sliding up and overlay fading in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      setContentHeight(0);
      // Reset for next time
      translateY.setValue(SCREEN_HEIGHT);
      overlayOpacity.setValue(0);
    }
  }, [visible, translateY, overlayOpacity]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => {
        hasTriggeredExpansion.current = false;
        return true; // Always respond to gestures for all drawers
      },
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => {
        // Allow dragging in both directions
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          if (expandable && isExpanded) {
            // When expanded, dragging down should start collapsing
            if (gestureState.dy > 0) {
              // Start collapsing if dragged down more than 20px
              if (gestureState.dy > 20 && !hasTriggeredExpansion.current && needsExpansion) {
                hasTriggeredExpansion.current = true;
                LayoutAnimation.configureNext(
                  LayoutAnimation.create(
                    300,
                    LayoutAnimation.Types.easeInEaseOut,
                    LayoutAnimation.Properties.scaleXY
                  )
                );
                setIsExpanded(false);
              }
              translateY.setValue(gestureState.dy);
            }
          } else {
            // When collapsed (or not expandable), handle expand OR dismiss
            if (gestureState.dy < 0 && expandable && needsExpansion) {
              // Start expanding if dragged up more than 20px (only if expandable and content is tall enough)
              if (gestureState.dy < -20 && !hasTriggeredExpansion.current) {
                hasTriggeredExpansion.current = true;
                LayoutAnimation.configureNext(
                  LayoutAnimation.create(
                    300,
                    LayoutAnimation.Types.easeInEaseOut,
                    LayoutAnimation.Properties.scaleXY
                  )
                );
                setIsExpanded(true);
              }
            } else if (gestureState.dy > 0) {
              // Allow drag down for dismiss - show visual feedback immediately
              // This works for ALL drawers (expandable or not)
              translateY.setValue(gestureState.dy);
            }
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        hasTriggeredExpansion.current = false;
        
        if (gestureState.dy > 100 && !isExpanded) {
          // Dismiss: dragged down significantly from initial state
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: 250,
              useNativeDriver: true,
            }),
            Animated.timing(overlayOpacity, {
              toValue: 0,
              duration: 250,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onClose();
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
    [expandable, needsExpansion, isExpanded, translateY, overlayOpacity, onClose]
  );

  if (!visible) return null;

  const Content = scrollable ? ScrollView : View;
  const contentProps = scrollable 
    ? { 
        contentContainerStyle: [
          { paddingBottom: insets.bottom },
          contentStyle,
        ],
        style: { flex: 1 },
        showsVerticalScrollIndicator: true,
        bounces: true,
      }
    : { 
        style: [
          { paddingBottom: insets.bottom },
          contentStyle,
        ]
      };

  const handleOverlayPress = () => {
    // Animate drawer sliding down and overlay fading out
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <View style={styles.drawerOverlay} pointerEvents="box-none">
      {/* Backdrop overlay */}
      <Animated.View style={[styles.drawerBackdrop, { opacity: overlayOpacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleOverlayPress}
        />
      </Animated.View>

      <Animated.View style={[
        styles.drawerContainer,
        {
          maxHeight: expandable ? currentMaxHeight : maxHeight,
          transform: [{ translateY }],
        }
      ]}>
        <View
          style={[
            styles.drawerSheet,
            {
              backgroundColor,
              borderBottomLeftRadius: deviceCornerRadius,
              borderBottomRightRadius: deviceCornerRadius,
            },
          ]}
        >
          {showHandle && (
            <View 
              style={styles.handleContainer}
              {...panResponder.panHandlers}
            >
              <View style={styles.sheetHandle} />
            </View>
          )}
          
          <Content {...contentProps}>
            <View
              onLayout={(event) => {
                if (expandable) {
                  const { height } = event.nativeEvent.layout;
                  setContentHeight(height);
                }
              }}
            >
              {children}
            </View>
          </Content>
        </View>
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
    flex: 1, // Fill parent's maxHeight constraint
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 0, // Bottom padding added to content for proper scrolling
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden', // Ensure content doesn't overflow rounded corners
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

