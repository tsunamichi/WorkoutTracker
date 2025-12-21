import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconCheckProps {
  size?: number;
  color?: string;
}

export function IconCheck({ size = 24, color = '#161616' }: IconCheckProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M6 12L10.2426 16.2426L18.727 7.75732"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

