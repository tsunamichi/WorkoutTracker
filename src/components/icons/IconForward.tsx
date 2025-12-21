import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconForwardProps {
  size?: number;
  color?: string;
}

export function IconForward({ size = 24, color = '#161616' }: IconForwardProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path 
        d="M12 12L3 17V7L12 12ZM12 12V7L21 12L12 17V12Z" 
        stroke={color} 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </Svg>
  );
}

