import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconFiltersProps {
  size?: number;
  color?: string;
}

export function IconFilters({ size = 24, color = '#161616' }: IconFiltersProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path d="M4 7H9M15 7H20M4 17H7M13 17H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="7" r="3" stroke={color} strokeWidth="2" />
      <Circle cx="10" cy="17" r="3" stroke={color} strokeWidth="2" />
    </Svg>
  );
}
