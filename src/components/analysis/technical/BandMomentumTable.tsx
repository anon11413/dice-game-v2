import { useEffect, useRef, useMemo } from 'react';
import { useDiceStore } from '../../../store/diceStore';

const BAND_NAMES = [
  'Scalpers',
  'Swing',
  'Position',
  'Fundamental',
  'Shorts',
  'MM',
  'Volatility',
  'Events',
  'Sentiment',
  'Regime',
];

const SPARKLINE_COUNT = 50;
const SPARK_W = 100;
const SPARK_H = 24;

function getInterpretation(bandIndex: number, mean: number): string {
  const isHigh = mean > 12;
  const isLow = mean < 9;

  switch (bandIndex) {
    case 0: // Scalpers
      return isHigh ? 'Strong scalp buying' : isLow ? 'Scalp selling pressure' : 'Neutral scalp flow';
    case 1: // Swing
      return isHigh ? 'Swing bullish bias' : isLow ? 'Swing bearish bias' : 'Balanced swing activity';
    case 2: // Position
      return isHigh ? 'Position accumulation' : isLow ? 'Position distribution' : 'Neutral positioning';
    case 3: // Fundamental
      return isHigh ? 'Strong value signal' : isLow ? 'Weak fundamentals' : 'Fair value range';
    case 4: // Shorts
      return isHigh ? 'Short covering rally' : isLow ? 'Elevated short activity' : 'Normal short interest';
    case 5: // MM
      return isHigh ? 'MM providing liquidity' : isLow ? 'MM pulling bids' : 'Normal market making';
    case 6: // Volatility
      return isHigh ? 'High volatility regime' : isLow ? 'Low volatility / squeeze' : 'Moderate volatility';
    case 7: // Events
      return isHigh ? 'Positive event catalyst' : isLow ? 'Negative event catalyst' : 'No event influence';
    case 8: // Sentiment
      return isHigh ? 'Strong bullish sentiment' : isLow ? 'Bearish sentiment' : 'Neutral sentiment';
    case 9: // Regime
      return isHigh ? 'Bull market regime' : isLow ? 'Bear market regime' : 'Transitional regime';
    default:
      return '';
  }
}

function Sparkline({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, SPARK_W, SPARK_H);

    const values = data.slice(-SPARKLINE_COUNT);
    if (values.length < 2) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 0.01);

    const toX = (i: number) => (i / (values.length - 1)) * SPARK_W;
    const toY = (v: number) => SPARK_H - 2 - ((v - min) / range) * (SPARK_H - 4);

    // Draw line
    const last = values[values.length - 1];
    const first = values[0];
    const isUp = last >= first;

    ctx.strokeStyle = isUp ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = toX(i);
      const y = toY(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area below
    ctx.lineTo(toX(values.length - 1), SPARK_H);
    ctx.lineTo(toX(0), SPARK_H);
    ctx.closePath();
    ctx.fillStyle = isUp ? '#22c55e10' : '#ef444410';
    ctx.fill();

    // End dot
    ctx.beginPath();
    ctx.arc(toX(values.length - 1), toY(last), 2, 0, Math.PI * 2);
    ctx.fillStyle = isUp ? '#22c55e' : '#ef4444';
    ctx.fill();
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={SPARK_W}
      height={SPARK_H}
      className="inline-block"
      style={{ width: SPARK_W, height: SPARK_H }}
    />
  );
}

export function BandMomentumTable() {
  const bandMeans = useDiceStore((s) => s.bandMeans);
  const bandMeansHistory = useDiceStore((s) => s.bandMeansHistory);

  const rows = useMemo(() => {
    return BAND_NAMES.map((name, i) => {
      const mean = bandMeans[i];
      const history = bandMeansHistory[i] ?? [];
      const prev = history.length >= 2 ? history[history.length - 2] : mean;
      const delta = mean - prev;

      return {
        name,
        mean,
        delta,
        history,
        interpretation: getInterpretation(i, mean),
      };
    });
  }, [bandMeans, bandMeansHistory]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Band Momentum</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-1 px-1 font-medium">Band</th>
              <th className="text-right py-1 px-1 font-medium">Mean</th>
              <th className="text-right py-1 px-1 font-medium">Delta</th>
              <th className="text-center py-1 px-1 font-medium">Sparkline</th>
              <th className="text-left py-1 px-1 font-medium">Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const meanColor =
                row.mean > 12 ? '#22c55e' : row.mean < 9 ? '#ef4444' : '#e5e7eb';
              const deltaColor =
                row.delta > 0 ? '#22c55e' : row.delta < 0 ? '#ef4444' : '#6b7280';
              const deltaArrow = row.delta > 0.01 ? '\u2191' : row.delta < -0.01 ? '\u2193' : '\u2022';

              return (
                <tr
                  key={i}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-1.5 px-1 text-gray-300 font-medium whitespace-nowrap">
                    {row.name}
                  </td>
                  <td
                    className="py-1.5 px-1 text-right font-mono font-medium"
                    style={{ color: meanColor }}
                  >
                    {row.mean.toFixed(2)}
                  </td>
                  <td
                    className="py-1.5 px-1 text-right font-mono"
                    style={{ color: deltaColor }}
                  >
                    {deltaArrow} {Math.abs(row.delta).toFixed(2)}
                  </td>
                  <td className="py-1 px-1 text-center">
                    <Sparkline data={row.history} />
                  </td>
                  <td className="py-1.5 px-1 text-gray-400 whitespace-nowrap">
                    {row.interpretation}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
