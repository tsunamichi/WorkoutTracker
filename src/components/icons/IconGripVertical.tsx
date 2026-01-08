import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface IconGripVerticalProps {
  size?: number;
  color?: string;
}

export function IconGripVertical({ size = 24, color = '#000000' }: IconGripVerticalProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10" cy="6" r="1.5" fill={color} />
      <Circle cx="14" cy="6" r="1.5" fill={color} />
      <Circle cx="10" cy="12" r="1.5" fill={color} />
      <Circle cx="14" cy="12" r="1.5" fill={color} />
      <Circle cx="10" cy="18" r="1.5" fill={color} />
      <Circle cx="14" cy="18" r="1.5" fill={color} />
    </Svg>
  );
}

