import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconSpeakerProps {
  size?: number;
  color?: string;
  muted?: boolean;
}

export function IconSpeaker({ size = 24, color = '#161616', muted = false }: IconSpeakerProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      {/* Speaker cone */}
      <Path
        d="M9.6 20.4L4.5 15.3H2C1.4 15.3 1 14.9 1 14.3V9.7C1 9.1 1.4 8.7 2 8.7H4.5L9.6 3.6C10.1 3.1 11 3.4 11 4.1V19.9C11 20.6 10.1 20.9 9.6 20.4Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {muted ? (
        /* X for muted */
        <>
          <Path
            d="M16 9L22 15"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Path
            d="M22 9L16 15"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        /* Sound waves */
        <>
          <Path
            d="M15 8.5C15.8 9.3 16.3 10.5 16.3 11.8C16.3 13.1 15.8 14.3 15 15.1"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M18 5.5C19.5 7 20.5 9.2 20.5 11.8C20.5 14.4 19.5 16.6 18 18.1"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}

