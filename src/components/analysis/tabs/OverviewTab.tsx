import { MarketPulseGauge } from '../overview/MarketPulseGauge';
import { MomentumArrow } from '../overview/MomentumArrow';
import { SafetyRating } from '../overview/SafetyRating';
import { PriceSparkline } from '../overview/PriceSparkline';
import { WhatTheDiceSay } from '../overview/WhatTheDiceSay';
import { VolumePulse } from '../overview/VolumePulse';
import { SqueezeAlert } from '../overview/SqueezeAlert';

export function OverviewTab() {
  return (
    <div className="overflow-y-auto p-2 space-y-3">
      {/* Market Pulse - full width */}
      <MarketPulseGauge />

      {/* Momentum + Safety - side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MomentumArrow />
        <SafetyRating />
      </div>

      {/* Price Sparkline - full width */}
      <PriceSparkline />

      {/* What the Dice Say - full width */}
      <WhatTheDiceSay />

      {/* Volume Pulse + Squeeze Alert - side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <VolumePulse />
        <SqueezeAlert />
      </div>
    </div>
  );
}
