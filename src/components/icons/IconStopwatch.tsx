import React from 'react';
import Svg, { Path, Circle, G, Defs, ClipPath, Rect } from 'react-native-svg';

interface IconStopwatchProps {
  size?: number;
  color?: string;
}

export function IconStopwatch({ size = 24, color = '#161616' }: IconStopwatchProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 21 21" fill="none" pointerEvents="none">
      <G clipPath="url(#clip0_icon_timer)">
        <Circle
          cx="11.1249"
          cy="11.8099"
          r="6.46128"
          fill={color}
          fillOpacity={0.16}
        />
        <Circle
          cx="10.4852"
          cy="11.8099"
          r="6.46128"
          stroke={color}
          strokeWidth={1.67198}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M7.87891 1.73975H10.314M10.314 1.73975H12.749M10.314 1.73975L10.3054 5.01202"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M10.2295 8.5376V12.1272H13.8191"
          stroke={color}
          strokeWidth={1.67198}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <Defs>
        <ClipPath id="clip0_icon_timer">
          <Rect width="20.6104" height="20.6104" fill="white" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}
