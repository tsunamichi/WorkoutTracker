import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconSwapProps {
  size?: number;
  color?: string;
}

export function IconSwap({ size = 24, color = '#161616' }: IconSwapProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path 
        d="M7 16V4M7 4L3 8M7 4L11 8" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <Path 
        d="M17 8V20M17 20L21 16M17 20L13 16" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </Svg>
  );
}

