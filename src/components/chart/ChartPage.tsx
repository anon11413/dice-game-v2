import { useState } from 'react';
import { TickerBar } from './TickerBar';
import { ResolutionSelector } from './ResolutionSelector';
import { ChartModeToggle } from './ChartModeToggle';
import { IndicatorMenu } from './IndicatorMenu';
import { PriceChart } from './PriceChart';
import { VolumePane } from './VolumePane';
import { RsiPane } from './RsiPane';
import { MacdPane } from './MacdPane';
import { SqueezePane } from './SqueezePane';
import { useIndicatorStore } from '../../store/indicatorStore';
import { RESOLUTIONS } from '../../engine/constants';

export function ChartPage() {
  const [resolution, setResolution] = useState(RESOLUTIONS.TICK);
  const [chartMode, setChartMode] = useState<'candle' | 'line'>('candle');
  const indicators = useIndicatorStore((s) => s.enabled);

  return (
    <div className="flex flex-col h-full">
      <TickerBar />

      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-[#0d1117] border-b border-gray-800">
        <ResolutionSelector selected={resolution} onChange={setResolution} />
        <ChartModeToggle mode={chartMode} onChange={setChartMode} />
        <div className="flex-1" />
        <IndicatorMenu />
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 min-h-0">
        <PriceChart resolution={resolution} mode={chartMode} />
      </div>

      {/* Sub-panes */}
      {indicators.volume && <VolumePane resolution={resolution} />}
      {indicators.rsi && <RsiPane resolution={resolution} />}
      {indicators.macd && <MacdPane resolution={resolution} />}
      {indicators.ttmSqueeze && <SqueezePane resolution={resolution} />}
    </div>
  );
}
