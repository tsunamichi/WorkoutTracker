import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconTriangleProps {
  size?: number;
  color?: string;
}

export function IconTriangle({ size = 24, color = '#161616' }: IconTriangleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M8 6L18 12L8 18V6Z"
        fill={color}
      />
    </Svg>
  );
}

