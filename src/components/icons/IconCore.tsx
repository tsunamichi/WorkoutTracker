import React, { useRef } from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';

interface IconCoreProps {
  size?: number;
  color?: string;
}

export function IconCore({ size = 24, color = '#161616' }: IconCoreProps) {
  const clipId = useRef(`clipCore-${Math.random().toString(36).slice(2)}`).current;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <G clipPath={`url(#${clipId})`}>
        <Path
          opacity="0.16"
          d="M6 14L13 2V10H18L11 22V14H6Z"
          fill={color}
        />
        <Path
          d="M6 14L13 2V10H18L11 22V14H6Z"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </G>
      <Defs>
        <ClipPath id={clipId}>
          <Rect width="24" height="24" fill="white" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}
