import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconChevronDownProps {
  size?: number;
  color?: string;
}

export function IconChevronDown({ size = 24, color = '#161616' }: IconChevronDownProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M15 11L12 14L9 11"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
