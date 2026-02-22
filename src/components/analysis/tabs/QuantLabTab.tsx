import { RevealModeToggle } from '../quant/RevealModeToggle';
import { RegimeEstimator } from '../quant/RegimeEstimator';
import { KappaEstimator } from '../quant/KappaEstimator';
import { SentimentEstimator } from '../quant/SentimentEstimator';
import { FundamentalEstimator } from '../quant/FundamentalEstimator';
import { EventRadar } from '../quant/EventRadar';
import { SqueezeProbabilityModel } from '../quant/SqueezeProbabilityModel';
import { MicroAgentConsensusMap } from '../quant/MicroAgentConsensusMap';
import { LiquidityDepthMap } from '../quant/LiquidityDepthMap';
import { ReturnDistribution } from '../quant/ReturnDistribution';
import { SignalDashboard } from '../quant/SignalDashboard';
import { OrderSourceBreakdown } from '../quant/OrderSourceBreakdown';
import { Band8ExtremesHeatmap } from '../quant/Band8ExtremesHeatmap';

export function QuantLabTab() {
  return (
    <div className="overflow-y-auto p-2 sm:p-3 space-y-3">
      {/* Reveal mode toggle at top */}
      <RevealModeToggle />

      {/* Row 1: Regime + Kappa + Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        <RegimeEstimator />
        <KappaEstimator />
        <SentimentEstimator />
      </div>

      {/* Row 2: Fundamental + Event Radar + Squeeze */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        <FundamentalEstimator />
        <EventRadar />
        <SqueezeProbabilityModel />
      </div>

      {/* Row 3: Consensus Map (2 cols) + Liquidity Depth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <MicroAgentConsensusMap />
        </div>
        <LiquidityDepthMap />
      </div>

      {/* Row 4: Return Distribution (2 cols) + Signal Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <ReturnDistribution />
        </div>
        <SignalDashboard />
      </div>

      {/* Row 5: Band 8 Extremes (2 cols) + Order Source Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Band8ExtremesHeatmap />
        </div>
        <OrderSourceBreakdown />
      </div>
    </div>
  );
}
