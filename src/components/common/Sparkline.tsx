import React from 'react';
import Svg, { Polyline } from 'react-native-svg';

interface SparklineProps {
  data: number[];
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
}

export function Sparkline({ data, width, height, color, strokeWidth = 1.5 }: SparklineProps) {
  if (data.length < 2) return null;

  const padding = strokeWidth;
  const drawW = width - padding * 2;
  const drawH = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = padding + (i / (data.length - 1)) * drawW;
      const y = padding + drawH - ((v - min) / range) * drawH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
