import React from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';

interface IconPauseProps {
  size?: number;
  color?: string;
}

export function IconPause({ size = 24, color = '#161616' }: IconPauseProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <G clipPath="url(#clip0_265_4825)">
        <Path
          d="M8 4H6C5.46957 4 4.96086 4.21071 4.58579 4.58579C4.21071 4.96086 4 5.46957 4 6V18C4 18.5304 4.21071 19.0391 4.58579 19.4142C4.96086 19.7893 5.46957 20 6 20H8C8.53043 20 9.03914 19.7893 9.41421 19.4142C9.78929 19.0391 10 18.5304 10 18V6C10 5.46957 9.78929 4.96086 9.41421 4.58579C9.03914 4.21071 8.53043 4 8 4Z"
          fill={color}
        />
        <Path
          d="M18 4H16C15.4696 4 14.9609 4.21071 14.5858 4.58579C14.2107 4.96086 14 5.46957 14 6V18C14 18.5304 14.2107 19.0391 14.5858 19.4142C14.9609 19.7893 15.4696 20 16 20H18C18.5304 20 19.0391 19.7893 19.4142 19.4142C19.7893 19.0391 20 18.5304 20 18V6C20 5.46957 19.7893 4.96086 19.4142 4.58579C19.0391 4.21071 18.5304 4 18 4Z"
          fill={color}
        />
      </G>
      <Defs>
        <ClipPath id="clip0_265_4825">
          <Rect width="24" height="24" fill="white"/>
        </ClipPath>
      </Defs>
    </Svg>
  );
}
