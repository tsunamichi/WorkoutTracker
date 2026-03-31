import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconArrowDiagonalProps {
  size?: number;
  color?: string;
}

export function IconArrowDiagonal({ size = 10, color = '#828282' }: IconArrowDiagonalProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10" fill="none" pointerEvents="none">
      <Path
        d="M0.75 0.75H8.75V8.75"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="bevel"
      />
      <Path
        d="M8.75016 0.75L1.0835 8.41667"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="bevel"
      />
    </Svg>
  );
}
