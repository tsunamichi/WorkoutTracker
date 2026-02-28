import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconCalendarProps {
  size?: number;
  color?: string;
}

export function IconCalendar({ size = 24, color = '#161616' }: IconCalendarProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        opacity={0.16}
        d="M4 8H20V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V8Z"
        fill={color}
      />
      <Path
        d="M4 4H20V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V4Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 8H20"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 3V5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 3V5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
