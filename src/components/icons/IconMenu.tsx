import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface IconMenuProps {
  size?: number;
  color?: string;
}

export function IconMenu({ size = 24, color = '#161616' }: IconMenuProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Circle cx="5" cy="12" r="1.5" fill={color} />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      <Circle cx="19" cy="12" r="1.5" fill={color} />
    </Svg>
  );
}

