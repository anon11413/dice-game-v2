import { useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import type { IRange, Time } from 'lightweight-charts';
import { TickerBar } from './TickerBar';
import { ResolutionSelector } from './ResolutionSelector';
import { ChartModeToggle } from './ChartModeToggle';
import { IndicatorMenu } from './IndicatorMenu';
import { PriceChart } from './PriceChart';
import { VolumePane } from './VolumePane';
import { RsiPane } from './RsiPane';
import { MacdPane } from './MacdPane';
import { SqueezePane } from './SqueezePane';
import { TradePanel } from '../trading/TradePanel';
import { useIndicatorStore } from '../../store/indicatorStore';
import { RESOLUTIONS } from '../../engine/constants';

export function ChartPage() {
  const [resolution, setResolution] = useState<number>(RESOLUTIONS.ONE_MIN);
  const [chartMode, setChartMode] = useState<'candle' | 'line'>('candle');
  const [showTrade, setShowTrade] = useState(false);
  const [activeAsset, setActiveAsset] = useState<'A' | 'B'>('A');
  const [visibleRange, setVisibleRange] = useState<IRange<Time> | null>(null);
  const indicators = useIndicatorStore((s) => s.enabled);
  const handleVisibleRangeChange = useCallback((range: IRange<Time> | null) => setVisibleRange(range), []);
  const location = useLocation();
  const isPlayerMode = location.pathname.startsWith('/play');

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chart area */}
      <div className="flex flex-col flex-1 min-w-0">
        <TickerBar />

        {/* Toolbar */}
        <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-1.5 bg-[#0d1117] border-b border-gray-800 flex-wrap flex-shrink-0">
          <ResolutionSelector selected={resolution} onChange={setResolution} />
          <ChartModeToggle mode={chartMode} onChange={setChartMode} />
          <div className="flex-1" />
          <IndicatorMenu />
          {isPlayerMode && (
            <button
              onClick={() => setShowTrade(!showTrade)}
              className="lg:hidden text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium min-h-[36px]"
            >
              Trade
            </button>
          )}
        </div>

        {/* Main Chart Area */}
        <div className="flex-1 min-h-0">
          <PriceChart resolution={resolution} mode={chartMode} activeAsset={activeAsset} onVisibleRangeChange={handleVisibleRangeChange} />
        </div>

        {/* Sub-panes — flex-shrink-0 prevents layout thrashing on mobile */}
        {indicators.volume && <div className="flex-shrink-0"><VolumePane resolution={resolution} visibleRange={visibleRange} /></div>}
        {indicators.rsi && <div className="flex-shrink-0"><RsiPane resolution={resolution} visibleRange={visibleRange} /></div>}
        {indicators.macd && <div className="flex-shrink-0"><MacdPane resolution={resolution} visibleRange={visibleRange} /></div>}
        {indicators.ttmSqueeze && <div className="flex-shrink-0"><SqueezePane resolution={resolution} visibleRange={visibleRange} /></div>}
      </div>

      {/* Trade Panel - Desktop: always visible sidebar, Mobile: overlay */}
      {isPlayerMode && (
        <>
          {/* Desktop sidebar */}
          <div className="hidden lg:block w-72 xl:w-80 border-l border-gray-800 overflow-y-auto flex-shrink-0">
            <TradePanel activeAsset={activeAsset} onAssetChange={setActiveAsset} />
          </div>

          {/* Mobile overlay */}
          {showTrade && (
            <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={() => setShowTrade(false)}>
              <div
                className="max-h-[80vh] overflow-y-auto rounded-t-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-[#0d1117] p-1 flex justify-center">
                  <div className="w-10 h-1 bg-gray-600 rounded-full" />
                </div>
                <TradePanel activeAsset={activeAsset} onAssetChange={setActiveAsset} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
