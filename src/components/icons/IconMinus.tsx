import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconMinusProps {
  size?: number;
  color?: string;
}

export function IconMinus({ size = 24, color = '#DEDEDE' }: IconMinusProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M8 12H16M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
