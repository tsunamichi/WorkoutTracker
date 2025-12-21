import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconArrowLeftProps {
  size?: number;
  color?: string;
}

export function IconArrowLeft({ size = 24, color = '#161616' }: IconArrowLeftProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M17 12H7M7 12L11 8M7 12L11 16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

