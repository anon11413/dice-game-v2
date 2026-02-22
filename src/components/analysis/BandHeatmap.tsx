import { useEffect, useRef, useState } from 'react';
import { useDiceStore } from '../../store/diceStore';
import { DICE_COLOR_LUT } from '../../utils/colorScale';

const BAND_ROWS = 10;
const GRID_COLS = 100;
const CELL_W = 5;
const CELL_H = 12;
const WIDTH = GRID_COLS * CELL_W;
const HEIGHT = BAND_ROWS * CELL_H;

const BAND_NAMES = [
  'Band 1: Scalpers', 'Band 2: Swing', 'Band 3: Position', 'Band 4: Value',
  'Band 5: Shorts', 'Band 6: MMs', 'Band 7: Volatility', 'Band 8: Events',
  'Band 9: Sentiment', 'Band 10: Regime',
];

export function BandHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = useDiceStore((s) => s.grid);
  const [selectedBand, setSelectedBand] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(WIDTH, HEIGHT);
    const data = imageData.data;
    const bandStart = selectedBand * BAND_ROWS * GRID_COLS;

    for (let r = 0; r < BAND_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const value = grid[bandStart + r * GRID_COLS + c];
        const [rv, gv, bv] = DICE_COLOR_LUT[value - 1];

        for (let dy = 0; dy < CELL_H; dy++) {
          for (let dx = 0; dx < CELL_W; dx++) {
            const px = c * CELL_W + dx;
            const py = r * CELL_H + dy;
            const idx = (py * WIDTH + px) * 4;
            data[idx] = rv;
            data[idx + 1] = gv;
            data[idx + 2] = bv;
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [grid, selectedBand]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-300">Band Detail</h3>
        <select
          value={selectedBand}
          onChange={(e) => setSelectedBand(Number(e.target.value))}
          className="text-xs bg-gray-800 border border-gray-700 rounded px-1 py-0.5 text-gray-300"
        >
          {BAND_NAMES.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="w-full border border-gray-700 rounded"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="text-[9px] text-gray-500 mt-1">
        10 rows × 100 columns — each column is one micro-agent
      </div>
    </div>
  );
}
