import React from 'react';
import Svg, { Path, G, Defs, ClipPath, Rect } from 'react-native-svg';

interface IconPlayProps {
  size?: number;
  color?: string;
}

export function IconPlay({ size = 24, color = '#161616' }: IconPlayProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      <G clipPath="url(#clip0_265_4821)">
        <Path
          d="M4.49976 4.00004V20C4.49971 20.178 4.54713 20.3527 4.63714 20.5062C4.72714 20.6597 4.85647 20.7864 5.01178 20.8732C5.16709 20.96 5.34275 21.0038 5.52064 21.0001C5.69853 20.9964 5.87221 20.9453 6.02376 20.852L19.0238 12.852C19.1694 12.7626 19.2896 12.6373 19.373 12.4881C19.4564 12.339 19.5002 12.1709 19.5002 12C19.5002 11.8291 19.4564 11.6611 19.373 11.512C19.2896 11.3628 19.1694 11.2375 19.0238 11.148L6.02376 3.14804C5.87221 3.0548 5.69853 3.00369 5.52064 2.99997C5.34275 2.99626 5.16709 3.04007 5.01178 3.1269C4.85647 3.21372 4.72714 3.34042 4.63714 3.4939C4.54713 3.64739 4.49971 3.82211 4.49976 4.00004Z"
          fill={color}
        />
      </G>
      <Defs>
        <ClipPath id="clip0_265_4821">
          <Rect width="24" height="24" fill="white"/>
        </ClipPath>
      </Defs>
    </Svg>
  );
}
