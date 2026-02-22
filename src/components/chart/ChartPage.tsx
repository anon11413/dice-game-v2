import { useState } from 'react';
import { useLocation } from 'react-router-dom';
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
  const [resolution, setResolution] = useState<number>(RESOLUTIONS.TICK);
  const [chartMode, setChartMode] = useState<'candle' | 'line'>('candle');
  const [showTrade, setShowTrade] = useState(false);
  const indicators = useIndicatorStore((s) => s.enabled);
  const location = useLocation();
  const isPlayerMode = location.pathname.startsWith('/play');

  return (
    <div className="flex h-full">
      {/* Chart area */}
      <div className="flex flex-col flex-1 min-w-0">
        <TickerBar />

        {/* Toolbar */}
        <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-1.5 bg-[#0d1117] border-b border-gray-800 flex-wrap">
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
          <PriceChart resolution={resolution} mode={chartMode} />
        </div>

        {/* Sub-panes */}
        {indicators.volume && <VolumePane resolution={resolution} />}
        {indicators.rsi && <RsiPane resolution={resolution} />}
        {indicators.macd && <MacdPane resolution={resolution} />}
        {indicators.ttmSqueeze && <SqueezePane resolution={resolution} />}
      </div>

      {/* Trade Panel - Desktop: always visible sidebar, Mobile: overlay */}
      {isPlayerMode && (
        <>
          {/* Desktop sidebar */}
          <div className="hidden lg:block w-72 xl:w-80 border-l border-gray-800 overflow-y-auto flex-shrink-0">
            <TradePanel />
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
                <TradePanel />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
