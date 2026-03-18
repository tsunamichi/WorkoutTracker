import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Squircle (continuous corner) constant for the Bézier approximation.
 * Control points sit on the two edges at distance r*c from the corner.
 * c = 0.447715 matches the flatter, hardware-like curve (not a circular arc).
 */
const SQUIRCLE_C = 0.447715;

export interface DeviceEdgeTimerProps {
  /** Time-left fraction: 1 = full border, 0 = consumed. Full path length = 100% of timer duration (1:1). */
  progress: Animated.Value;
  strokeColor: string;
  strokeWidth?: number;
  /** Optional; defaults to Dimensions.get('window'). Enables testing / override. */
  width?: number;
  height?: number;
  /** When true, border is shown and intro animation runs. Component stays mounted so intro can start from frame 0. */
  visible?: boolean;
}

/**
 * Device-edge rest timer: a stroke that follows the visible device outline with
 * continuous (squircle-style) corners, then consumes clockwise as progress goes 1 → 0.
 * Intended to feel like system UI (e.g. Siri / Apple Intelligence edge treatment).
 * Absolute-positioned, does not affect layout; stroke sits just inside the edge.
 */
export function DeviceEdgeTimer({
  progress,
  strokeColor,
  strokeWidth = 4,
  width: widthProp,
  height: heightProp,
  visible = true,
}: DeviceEdgeTimerProps) {
  const dims = Dimensions.get('window');
  const width = widthProp ?? dims.width;
  const height = heightProp ?? dims.height;

  const { path, perimeter } = useMemo(() => {
    const inset = strokeWidth / 2;
    const x1 = inset;
    const y1 = inset;
    const x2 = width - inset;
    const y2 = height - inset;
    const cx = width / 2;

    const maxROuter = Math.min(width / 2, height / 2);
    const R_device =
      Platform.OS === 'ios'
        ? Math.min(maxROuter, Math.min(width, height) * 0.14, 56)
        : 0;
    const maxRInner = Math.min((width - 2 * inset) / 2, (height - 2 * inset) / 2);
    const r = Math.max(0, Math.min(R_device - inset, maxRInner));

    const round = (n: number) => Math.round(n);
    if (r <= 0) {
      const path = `M ${round(cx)} ${round(y1)} L ${round(x2)} ${round(y1)} L ${round(x2)} ${round(y2)} L ${round(x1)} ${round(y2)} L ${round(x1)} ${round(y1)} L ${round(cx)} ${round(y1)} Z`;
      const perimeter = 2 * (width - 2 * inset) + 2 * (height - 2 * inset);
      return { path, perimeter };
    }

    const c = SQUIRCLE_C;
    const tr = (x: number, y: number) => `${round(x)} ${round(y)}`;
    // Path starts at top-center (12 o'clock) so progress origin is at Dynamic Island area; then clockwise.
    const path = [
      `M ${tr(cx, y1)}`,
      `L ${tr(x2 - r, y1)}`,
      `C ${tr(x2 - r * c, y1)} ${tr(x2, y1 + r * c)} ${tr(x2, y1 + r)}`,
      `L ${tr(x2, y2 - r)}`,
      `C ${tr(x2, y2 - r * c)} ${tr(x2 - r * c, y2)} ${tr(x2 - r, y2)}`,
      `L ${tr(x1 + r, y2)}`,
      `C ${tr(x1 + r * c, y2)} ${tr(x1, y2 - r * c)} ${tr(x1, y2 - r)}`,
      `L ${tr(x1, y1 + r)}`,
      `C ${tr(x1, y1 + r * c)} ${tr(x1 + r * c, y1)} ${tr(x1 + r, y1)}`,
      `L ${tr(cx, y1)}`,
      'Z',
    ].join(' ');

    const straight = 2 * (width - 2 * inset - 2 * r) + 2 * (height - 2 * inset - 2 * r);
    const curve = 2 * Math.PI * r * 0.99;
    const perimeter = straight + curve;

    return { path, perimeter };
  }, [width, height, strokeWidth]);

  const strokeWidthAnim = useRef(new Animated.Value(0)).current;
  const prevVisibleRef = useRef(visible);
  const exitAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const introRafRef = useRef<number | null>(null);
  const lastProgressRef = useRef(1);
  const [frozenProgress, setFrozenProgress] = useState<number | null>(null);

  const INTRO_DURATION = 320;
  const EXIT_DURATION = 220;

  useEffect(() => {
    const listenerId = progress.addListener(({ value }) => {
      lastProgressRef.current = value;
    });
    return () => progress.removeListener(listenerId);
  }, [progress]);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible) {
      setFrozenProgress(null);
      if (exitAnimRef.current) {
        exitAnimRef.current.stop();
        exitAnimRef.current = null;
      }
      strokeWidthAnim.setValue(0);
      let cancelled = false;
      const raf2 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          Animated.timing(strokeWidthAnim, {
            toValue: strokeWidth,
            duration: INTRO_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }).start();
        });
      });
      introRafRef.current = raf2;
      return () => {
        cancelled = true;
        if (introRafRef.current != null) {
          cancelAnimationFrame(introRafRef.current);
          introRafRef.current = null;
        }
      };
    }

    if (!wasVisible) return;

    setFrozenProgress(lastProgressRef.current);
    const exitAnim = Animated.timing(strokeWidthAnim, {
      toValue: 0,
      duration: EXIT_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    });
    exitAnimRef.current = exitAnim;
    exitAnim.start(({ finished }) => {
      exitAnimRef.current = null;
      if (finished) {
        strokeWidthAnim.setValue(0);
        setFrozenProgress(null);
      }
    });
    return () => {
      if (exitAnimRef.current) {
        exitAnimRef.current.stop();
        exitAnimRef.current = null;
      }
    };
  }, [visible, strokeWidth, strokeWidthAnim]);

  const L = perimeter;

  return (
    <View style={[styles.frame, { width, height }]} pointerEvents="none">
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {frozenProgress !== null ? (
            <AnimatedPath
              d={path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidthAnim}
              strokeLinecap="butt"
              strokeLinejoin="round"
              strokeDasharray={[frozenProgress * L, L]}
              strokeDashoffset={0}
            />
          ) : (
            <AnimatedPath
              d={path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidthAnim}
              strokeLinecap="butt"
              strokeLinejoin="round"
              strokeDasharray={progress.interpolate({
                inputRange: [0, 1],
                outputRange: [`0 ${L}`, `${L} ${L}`],
              })}
              strokeDashoffset={0}
            />
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1000,
  },
});
