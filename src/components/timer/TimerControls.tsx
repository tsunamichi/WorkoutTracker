import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { IconPlay, IconPause, IconSoundOn, IconSoundOff, IconSkip, IconRestart } from '../icons';

const LIGHT_COLORS = {
  backgroundCanvas: '#E3E6E0',
  textSecondary: '#3C3C43',
  secondary: '#1B1B1B',
};

interface TimerControlsProps {
  isRunning: boolean;
  isPaused?: boolean;
  soundEnabled: boolean;
  onTogglePause: () => void;
  onToggleSound: () => void;
  onSkip: () => void;
  showRestart?: boolean;
  onRestart?: () => void;
  hideControlsWhenPaused?: boolean;
}

export function TimerControls({
  isRunning,
  isPaused = false,
  soundEnabled,
  onTogglePause,
  onToggleSound,
  onSkip,
  showRestart = false,
  onRestart,
  hideControlsWhenPaused = false,
}: TimerControlsProps) {
  const sideButtonsAnim = useRef(new Animated.Value(hideControlsWhenPaused ? 0 : 1)).current;

  useEffect(() => {
    if (!hideControlsWhenPaused) {
      // Always show if hideControlsWhenPaused is false
      Animated.spring(sideButtonsAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
      return;
    }

    // Show when running, hide when paused/stopped
    Animated.spring(sideButtonsAnim, {
      toValue: isRunning ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [isRunning, hideControlsWhenPaused, sideButtonsAnim]);

  const shouldShowControls = !hideControlsWhenPaused || isRunning;

  return (
    <View style={styles.container}>
      {/* Left button: Sound toggle */}
      <Animated.View
        style={[
          styles.sideButtonContainer,
          {
            opacity: sideButtonsAnim,
            transform: [
              {
                translateX: sideButtonsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
              { scale: sideButtonsAnim },
            ],
          },
        ]}
        pointerEvents={shouldShowControls ? 'auto' : 'none'}
      >
        <TouchableOpacity
          onPress={onToggleSound}
          style={styles.sideButtonTouchable}
          activeOpacity={1}
        >
          {soundEnabled ? (
            <IconSoundOn size={28} color={LIGHT_COLORS.textSecondary} />
          ) : (
            <IconSoundOff size={28} color={LIGHT_COLORS.textSecondary} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Center button: Play/Pause/Restart */}
      <TouchableOpacity
        onPress={showRestart && onRestart ? onRestart : onTogglePause}
        activeOpacity={1}
        style={styles.playPauseButton}
      >
        {showRestart ? (
          <IconRestart size={24} color="#FFFFFF" />
        ) : isRunning ? (
          <IconPause size={24} color="#FFFFFF" />
        ) : (
          <IconPlay size={24} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      {/* Right button: Skip */}
      <Animated.View
        style={[
          styles.sideButtonContainer,
          {
            opacity: sideButtonsAnim,
            transform: [
              {
                translateX: sideButtonsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, 0],
                }),
              },
              { scale: sideButtonsAnim },
            ],
          },
        ]}
        pointerEvents={shouldShowControls ? 'auto' : 'none'}
      >
        <TouchableOpacity
          onPress={onSkip}
          style={styles.sideButtonTouchable}
          activeOpacity={1}
        >
          <IconSkip size={28} color={LIGHT_COLORS.textSecondary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    width: '100%',
  },
  playPauseButton: {
    backgroundColor: LIGHT_COLORS.secondary,
    width: 64,
    height: 64,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonContainer: {
    width: 56,
    height: 56,
  },
  sideButtonTouchable: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

