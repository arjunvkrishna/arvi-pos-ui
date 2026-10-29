import { useEffect, useRef } from 'react';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

/** Draws a Chart.js chart and cleans it up; the chart is rebuilt whenever `config` changes. */
export function ChartCanvas({ config, height = 220, label }: { config: ChartConfiguration; height?: number; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, config);
    return () => chart.destroy();
  }, [config]);
  return <div className="relative w-full min-w-0 overflow-hidden" style={{ height }}><canvas ref={canvas} role="img" aria-label={label} /></div>;
}
