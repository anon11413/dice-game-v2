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

      {/* Row 5: Band 8 Extremes placeholder + Order Source Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800 flex items-center justify-center min-h-[120px]">
          <div className="text-center">
            <span className="text-sm text-gray-500">Band 8 Extremes</span>
            <br />
            <span className="text-xs text-gray-600">Coming Soon</span>
          </div>
        </div>
        <OrderSourceBreakdown />
      </div>
    </div>
  );
}
