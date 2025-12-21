import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconAddTimeProps {
  size?: number;
  color?: string;
}

export function IconAddTime({ size = 24, color = '#161616' }: IconAddTimeProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M12 16V13M12 13V10M12 13H9M12 13H15M21 6L19 4M10 2H14M12 21C7.58172 21 4 17.4183 4 13C4 8.58172 7.58172 5 12 5C16.4183 5 20 8.58172 20 13C20 17.4183 16.4183 21 12 21Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

