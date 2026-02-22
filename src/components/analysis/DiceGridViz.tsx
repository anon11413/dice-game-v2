import { useEffect, useRef } from 'react';
import { useDiceStore } from '../../store/diceStore';
import { DICE_COLOR_LUT } from '../../utils/colorScale';

const CELL_SIZE = 4;
const GRID_ROWS = 100;
const GRID_COLS = 100;
const WIDTH = GRID_COLS * CELL_SIZE;
const HEIGHT = GRID_ROWS * CELL_SIZE;

const BAND_LABELS = [
  'Scalpers', 'Swing', 'Position', 'Value', 'Shorts',
  'MMs', 'Volatility', 'Events', 'Sentiment', 'Regime'
];

/**
 * 100x100 dice grid rendered as a Canvas heatmap.
 * Each cell is colored by dice value (1=blue, 10=gray, 20=red).
 */
export function DiceGridViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = useDiceStore((s) => s.grid);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create ImageData for fast pixel manipulation
    const imageData = ctx.createImageData(WIDTH, HEIGHT);
    const data = imageData.data;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const value = grid[row * GRID_COLS + col];
        const [r, g, b] = DICE_COLOR_LUT[value - 1];

        // Fill CELL_SIZE x CELL_SIZE block
        for (let dy = 0; dy < CELL_SIZE; dy++) {
          for (let dx = 0; dx < CELL_SIZE; dx++) {
            const px = col * CELL_SIZE + dx;
            const py = row * CELL_SIZE + dy;
            const idx = (py * WIDTH + px) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Draw band separators
    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 1;
    for (let b = 1; b < 10; b++) {
      const y = b * 10 * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }
  }, [grid]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Dice Grid (100x100)</h3>
      <div className="flex gap-2">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="border border-gray-700 rounded"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className="flex flex-col justify-between text-[9px] text-gray-500 py-1">
          {BAND_LABELS.map((label, i) => (
            <div key={i} className="leading-tight">{i + 1}. {label}</div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-500">
        <span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(30,50,200)' }} /> 1
        <span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(130,130,130)' }} /> 10
        <span className="w-3 h-3 rounded" style={{ backgroundColor: 'rgb(255,30,30)' }} /> 20
      </div>
    </div>
  );
}
