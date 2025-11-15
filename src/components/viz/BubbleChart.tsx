import type { JSX } from 'react';
import type { ScatterChartProps } from './ScatterChart.js';
import { ScatterChartBase } from './ScatterChart.js';

export type BubbleChartProps = ScatterChartProps;

export function BubbleChart(props: BubbleChartProps): JSX.Element {
  return <ScatterChartBase {...props} variant="bubble" />;
}
