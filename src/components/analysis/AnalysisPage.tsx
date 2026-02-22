import { DiceGridViz } from './DiceGridViz';
import { BandStatsPanel } from './BandStatsPanel';
import { BandHeatmap } from './BandHeatmap';
import { ShortInterestPanel } from './ShortInterestPanel';
import { OrderBookDepth } from './OrderBookDepth';
import { BandTimelineChart } from './BandTimelineChart';

export function AnalysisPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full">
      {/* Left column */}
      <div className="flex flex-col gap-3">
        <DiceGridViz />
        <BandHeatmap />
        <OrderBookDepth />
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-3">
        <BandStatsPanel />
        <ShortInterestPanel />
        <BandTimelineChart />
      </div>
    </div>
  );
}
