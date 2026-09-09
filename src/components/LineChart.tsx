import { useId, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export interface LineChartProps {
  /** Y-values in chronological order, oldest first. */
  values: number[];
  height?: number;
  color?: string;
}

/**
 * A minimal SVG line chart — bodyweight's trend here, Stats' per-exercise
 * progress chart reuses it. No charting library: `react-native-svg` is
 * already the PRD's chosen tool for this (§12), and a plain polyline with a
 * soft gradient fill is all either screen needs — nothing here calls for a
 * general-purpose charting engine's axes, legends, or interaction model.
 */
export function LineChart({ values, height = 140, color = colors.accent }: LineChartProps) {
  // React's useId() includes colons, which aren't safe inside a url(#...)
  // reference in every SVG renderer — strip them for a plain alphanumeric id.
  const gradientId = useId().replace(/:/g, '');
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (values.length < 2 || width === 0) {
    return <View style={{ height }} onLayout={onLayout} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = height * 0.12;
  const usableHeight = height - padY * 2;

  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: padY + usableHeight - ((v - min) / range) * usableHeight,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={4} fill={color} />
      </Svg>
    </View>
  );
}
