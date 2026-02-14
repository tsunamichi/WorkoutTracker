import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { IconPlay, IconPause, IconSoundOn, IconSoundOff, IconSkip, IconRestart } from '../icons';
import { COLORS } from '../../constants';

const LIGHT_COLORS = {
  backgroundCanvas: '#0D0D0D',
  textSecondary: '#AEAEB2',
  secondary: '#FFFFFF',
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
  disablePlayPause?: boolean;
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
  disablePlayPause = false,
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
            <IconSoundOn size={28} color={COLORS.accentPrimary} />
          ) : (
            <IconSoundOff size={28} color={COLORS.accentPrimary} />
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Center button: Play/Pause/Restart */}
      <TouchableOpacity
        onPress={showRestart && onRestart ? onRestart : onTogglePause}
        activeOpacity={1}
        style={[styles.playPauseButton, disablePlayPause && styles.playPauseButtonDisabled]}
        disabled={disablePlayPause}
      >
        {showRestart ? (
          <IconRestart size={24} color={disablePlayPause ? COLORS.textMeta : COLORS.accentPrimary} />
        ) : isRunning ? (
          <IconPause size={24} color={disablePlayPause ? COLORS.textMeta : COLORS.accentPrimary} />
        ) : (
          <IconPlay size={24} color={disablePlayPause ? COLORS.textMeta : COLORS.accentPrimary} />
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
          <IconSkip size={28} color={COLORS.accentPrimary} />
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
    backgroundColor: COLORS.accentPrimaryDimmed,
    width: 64,
    height: 64,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseButtonDisabled: {
    opacity: 0.5,
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

