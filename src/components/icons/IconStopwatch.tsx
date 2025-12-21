import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface IconStopwatchProps {
  size?: number;
  color?: string;
}

export function IconStopwatch({ size = 24, color = '#000000' }: IconStopwatchProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 8v5l3 3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx={12}
        cy={14}
        r={7}
        stroke={color}
        strokeWidth={2}
      />
      <Path
        d="M10 2h4M12 5V2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

