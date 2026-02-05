import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconCheckmarkProps {
  size?: number;
  color?: string;
}

export function IconCheckmark({ size = 24, color = '#161616' }: IconCheckmarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M20 6L9 17L4 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
