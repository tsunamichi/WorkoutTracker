import React from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';

interface IconMinusLineProps {
  size?: number;
  color?: string;
}

export function IconMinusLine({ size = 24, color = '#161616' }: IconMinusLineProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <G clipPath="url(#clip0_380_2080)">
        <Path
          d="M5 12H19"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <Defs>
        <ClipPath id="clip0_380_2080">
          <Rect width="24" height="24" fill="white"/>
        </ClipPath>
      </Defs>
    </Svg>
  );
}

