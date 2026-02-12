import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { COLORS } from '../../constants';

interface DiagonalLinePatternProps {
  width: number | string;
  height: number | string;
  borderRadius?: number;
}

export function DiagonalLinePattern({ width, height, borderRadius = 0 }: DiagonalLinePatternProps) {
  // Spacing: 2px line + 4px gap = 6px
  const spacing = 6;
  const lineWidth = 2;
  
  // Calculate number of lines needed (assuming max width of 500px)
  const maxDimension = 500;
  const numLines = Math.ceil((maxDimension * 2) / spacing);
  
  // Generate lines
  const lines = [];
  for (let i = -numLines; i < numLines; i++) {
    const offset = i * spacing;
    lines.push(
      <Line
        key={i}
        x1={offset}
        y1="0"
        x2={offset + maxDimension}
        y2={maxDimension}
        stroke={COLORS.activeCard}
        strokeWidth={lineWidth}
        strokeOpacity={0.8}
      />
    );
  }
  
  return (
    <View style={[styles.container, { width, height, borderRadius, overflow: 'hidden' }]} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        {lines}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
