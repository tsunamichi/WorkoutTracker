import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
  children: React.ReactNode | ((props: { requestClose: () => void }) => React.ReactNode);
  maxHeight?: string;
  backgroundColor?: string;
  showHandle?: boolean;
  contentStyle?: ViewStyle;
  scrollable?: boolean;
  expandable?: boolean; // New prop to enable pull-to-expand
  onRequestClose?: () => void; // Called when close is initiated (before animation)
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
  onRequestClose,
}: BottomDrawerProps) {
  const insets = useSafeAreaInsets();
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const hasTriggeredExpansion = useRef(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const frozenMaxHeight = useRef<number>(0);
  
  // Match device corner radius (iPhone rounded corners)
  const deviceCornerRadius = insets.bottom > 0 ? 40 : 24;

  // Calculate max drawer height (90% of screen minus bottom offset)
  const bottomOffset = 8; // drawer is positioned 8px from bottom
  const maxDrawerHeight = (SCREEN_HEIGHT - bottomOffset) * 0.9;
  
  // Handle height (if showHandle is true)
  const handleHeight = showHandle ? 28 : 0; // ~12px padding top + 4px handle + 12px padding bottom
  
  // Calculate actual drawer height based on content
  // If expandable, allow expansion; otherwise fit to content up to 90%
  const calculateDrawerHeight = () => {
    if (expandable && isExpanded) {
      return maxDrawerHeight;
    }
    if (contentHeight > 0) {
      // Content height + handle height, capped at maxDrawerHeight
      const totalNeededHeight = contentHeight + handleHeight;
      return Math.min(totalNeededHeight, maxDrawerHeight);
    }
    // Start with max height to allow proper content measurement
    return maxDrawerHeight;
  };
  
  const currentMaxHeight = calculateDrawerHeight();
  
  // Check if content needs scrolling (content is taller than available space)
  const needsScrolling = contentHeight + handleHeight > maxDrawerHeight;
  const needsExpansion = expandable && needsScrolling;

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Single effect to handle all visibility changes
  useEffect(() => {
    if (visible) {
      // Clear any pending close
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      
      // Show immediately
      setIsVisible(true);
      setIsExpanded(false);
      hasTriggeredExpansion.current = false;
      
      // Reset position before animating
      translateY.setValue(SCREEN_HEIGHT);
      overlayOpacity.setValue(0);
      
      // Animate in
      setTimeout(() => {
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
      }, 10);
    } else if (!visible && isVisible) {
      // Start close animation
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
      ]).start();
      
      // Hide after animation completes
      closeTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
        setContentHeight(0);
      }, 260); // Slightly longer than animation duration
    }
    
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [visible, isVisible, translateY, overlayOpacity]);

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
          onClose();
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

  // Only use ScrollView if content needs scrolling
  const shouldScroll = scrollable && needsScrolling;
  const Content = shouldScroll ? ScrollView : View;
  const contentProps = shouldScroll 
    ? { 
        contentContainerStyle: contentStyle,
        style: { flex: 1 },
        showsVerticalScrollIndicator: true,
        bounces: true,
      }
    : { 
        style: contentStyle
      };

  const requestClose = () => {
    // Animate first
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

  const handleOverlayPress = () => {
    requestClose();
  };

  // Render if visible OR if we're showing for animation
  if (!visible && !isVisible) {
    return null;
  }

  // During closing, keep showing the drawer in its open position
  const shouldShowContent = visible || isVisible;

  return (
    <View style={styles.drawerOverlay} pointerEvents="box-none">
      {/* Backdrop overlay */}
      <Animated.View style={[styles.drawerBackdrop, { opacity: overlayOpacity }]} pointerEvents={shouldShowContent ? 'auto' : 'none'}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleOverlayPress}
        />
      </Animated.View>

      <Animated.View style={[
        styles.drawerContainer,
        {
          maxHeight: currentMaxHeight,
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
              style={{ flexShrink: 0, paddingTop: 16 }}
              onLayout={(event) => {
                const { height } = event.nativeEvent.layout;
                setContentHeight(height);
              }}
            >
              {typeof children === 'function' ? children({ requestClose }) : children}
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
    paddingTop: 0,
    paddingHorizontal: 0,
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

