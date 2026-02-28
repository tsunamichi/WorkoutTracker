import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconEditProps {
  size?: number;
  color?: string;
}

export function IconEdit({ size = 24, color = '#161616' }: IconEditProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        opacity={0.16}
        d="M5 16L4 20L8 19L18 9L15 6L5 16Z"
        fill={color}
      />
      <Path
        d="M5 16L4 20L8 19L19.5858 7.41421C20.3668 6.63316 20.3668 5.36683 19.5858 4.58579L19.4142 4.41421C18.6332 3.63316 17.3668 3.63317 16.5858 4.41421L5 16Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 6L18 9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13 20H21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
