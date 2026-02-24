import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconImportProps {
  size?: number;
  color?: string;
}

export function IconImport({ size = 24, color = '#161616' }: IconImportProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <Path
        d="M12 3C12.5523 3 13 3.44772 13 4V13.586L15.293 11.293C15.6835 10.9025 16.3165 10.9025 16.707 11.293C17.0975 11.6835 17.0975 12.3165 16.707 12.707L12.707 16.707C12.3165 17.0975 11.6835 17.0975 11.293 16.707L7.293 12.707C6.90247 12.3165 6.90247 11.6835 7.293 11.293C7.68353 10.9025 8.31647 10.9025 8.707 11.293L11 13.586V4C11 3.44772 11.4477 3 12 3Z"
        fill={color}
      />
      <Path
        d="M4 17C4.55228 17 5 17.4477 5 18V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V18C19 17.4477 19.4477 17 20 17C20.5523 17 21 17.4477 21 18V19C21 20.6569 19.6569 22 18 22H6C4.34315 22 3 20.6569 3 19V18C3 17.4477 3.44772 17 4 17Z"
        fill={color}
      />
    </Svg>
  );
}
