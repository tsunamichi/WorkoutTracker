import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconChevronDownProps {
  size?: number;
  color?: string;
}

export function IconChevronDown({ size = 24, color = '#DEDEDE' }: IconChevronDownProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M15 11L12 14L9 11M21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

