import React, { useRef } from 'react';
import Svg, { Path, Circle, G, Defs, ClipPath, Rect } from 'react-native-svg';

interface IconWarmupProps {
  size?: number;
  color?: string;
}

export function IconWarmup({ size = 24, color = '#161616' }: IconWarmupProps) {
  const clipId = useRef(`clipWarmup-${Math.random().toString(36).slice(2)}`).current;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <G clipPath={`url(#${clipId})`}>
        <Circle opacity="0.16" cx="12" cy="12" r="4" fill={color} />
        <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <Path d="M20 12H21" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M3 12H4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M12 20L12 21" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M12 3L12 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M17.6567 17.6567L18.3638 18.3638" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M5.63623 5.63623L6.34334 6.34334" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M6.34326 17.6567L5.63615 18.3638" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M18.3638 5.63623L17.6567 6.34334" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </G>
      <Defs>
        <ClipPath id={clipId}>
          <Rect width="24" height="24" fill="white" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}
