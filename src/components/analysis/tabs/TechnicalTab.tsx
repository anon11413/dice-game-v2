import { MultiTimeframeMatrix } from '../technical/MultiTimeframeMatrix';
import { IndicatorDashboard } from '../technical/IndicatorDashboard';
import { OrderFlowSummary } from '../technical/OrderFlowSummary';
import { SupportResistanceMap } from '../technical/SupportResistanceMap';
import { DivergenceScanner } from '../technical/DivergenceScanner';
import { BandMomentumTable } from '../technical/BandMomentumTable';
import { CorrelationHeatmap } from '../technical/CorrelationHeatmap';

export function TechnicalTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-2">
      {/* Multi-Timeframe Matrix — full width */}
      <div className="lg:col-span-2">
        <MultiTimeframeMatrix />
      </div>

      {/* Indicator Dashboard + Order Flow Summary — side by side */}
      <IndicatorDashboard />
      <OrderFlowSummary />

      {/* Support/Resistance Map + Divergence Scanner — side by side */}
      <SupportResistanceMap />
      <DivergenceScanner />

      {/* Band Momentum Table + Correlation Heatmap — side by side */}
      <BandMomentumTable />
      <CorrelationHeatmap />
    </div>
  );
}
