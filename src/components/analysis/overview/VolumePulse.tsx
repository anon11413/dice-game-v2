import { useRef, useEffect, useCallback, useState } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { RESOLUTIONS } from '../../../engine/constants';

export function VolumePulse() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 100 });
  const animRef = useRef<number>(0);
  const offsetRef = useRef(0);
  const lastTimeRef = useRef(0);

  const candles = useMarketStore((s) => s.candles);
  const tickCandles = candles.get(RESOLUTIONS.TICK);

  // Extract last 20 volumes
  const volumes = tickCandles
    ? tickCandles.slice(-20).map((c) => c.volume)
    : [];

  const avgVolume = volumes.length > 0
    ? volumes.reduce((a, b) => a + b, 0) / volumes.length
    : 0;
  const maxVolume = volumes.length > 0 ? Math.max(...volumes) : 1;

  // Store volumes in a ref so the animation loop can access latest without re-creating
  const volumesRef = useRef(volumes);
  volumesRef.current = volumes;
  const avgVolRef = useRef(avgVolume);
  avgVolRef.current = avgVolume;
  const maxVolRef = useRef(maxVolume);
  maxVolRef.current = maxVolume;

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: 100 });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Delta time for smooth scrolling
    const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = timestamp;

    // Scroll speed proportional to average volume (clamped)
    const speed = 30 + Math.min(avgVolRef.current * 0.5, 150);
    offsetRef.current += speed * dt;

    const dpr = window.devicePixelRatio || 1;
    const w = dims.w;
    const h = dims.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const vols = volumesRef.current;
    const maxV = maxVolRef.current || 1;
    const cy = h / 2;

    if (vols.length === 0) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for volume data...', w / 2, cy);
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    // Draw a scrolling waveform
    // Each volume sample maps to a section of the wave
    const sectionWidth = w / 6; // visible sections
    const offset = offsetRef.current;

    ctx.beginPath();
    ctx.moveTo(0, cy);

    for (let x = 0; x < w; x++) {
      // Map x position to a volume index (wrapping)
      const worldX = x + offset;
      const volIdx = Math.floor(worldX / sectionWidth) % Math.max(1, vols.length);
      const safeIdx = ((volIdx % vols.length) + vols.length) % vols.length;
      const vol = vols[safeIdx] || 0;

      // Amplitude based on volume
      const amplitude = (vol / maxV) * (cy - 8);

      // Create heartbeat-like waveform
      const phase = ((worldX % sectionWidth) / sectionWidth) * Math.PI * 2;
      let y: number;

      // Heartbeat shape: sharp spike then settle
      const t = (worldX % sectionWidth) / sectionWidth;
      if (t < 0.15) {
        // Rising spike
        y = cy - amplitude * Math.sin(t / 0.15 * Math.PI * 0.5);
      } else if (t < 0.25) {
        // Falling spike
        y = cy - amplitude * Math.cos((t - 0.15) / 0.1 * Math.PI * 0.5);
      } else if (t < 0.35) {
        // Small dip
        y = cy + amplitude * 0.3 * Math.sin((t - 0.25) / 0.1 * Math.PI);
      } else if (t < 0.45) {
        // Secondary peak
        y = cy - amplitude * 0.5 * Math.sin((t - 0.35) / 0.1 * Math.PI);
      } else {
        // Flat line back to center
        const decay = Math.exp(-(t - 0.45) * 6);
        y = cy - amplitude * 0.1 * decay * Math.sin((t - 0.45) * 8);
      }

      ctx.lineTo(x, y);
    }

    // Gradient stroke
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, 'rgba(59,130,246,0.3)');
    gradient.addColorStop(0.5, 'rgba(59,130,246,0.9)');
    gradient.addColorStop(1, 'rgba(59,130,246,0.3)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glow effect
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(59,130,246,0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center line
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.strokeStyle = 'rgba(107,114,128,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    animRef.current = requestAnimationFrame(draw);
  }, [dims]);

  // Animation loop - always running
  useEffect(() => {
    lastTimeRef.current = 0;
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-300">Volume Pulse</h3>
        <span className="text-xs text-gray-500 tabular-nums">
          Avg: {avgVolume.toFixed(0)}
        </span>
      </div>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>
    </div>
  );
}
