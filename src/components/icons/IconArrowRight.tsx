import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconArrowRightProps {
  size?: number;
  color?: string;
}

export function IconArrowRight({ size = 24, color = '#161616' }: IconArrowRightProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M7 12H17M17 12L13 8M17 12L13 16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

