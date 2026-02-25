import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { ServerCandle } from '../engine/ServerEngine.js';
import { tickToTimestamp } from '../../src/engine/aggregation/CandleAggregator.js';

const BASE_PRICE = 100;
const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

let wss: WebSocketServer;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// Current price + tick count, set by index.ts on each tick so new clients get data immediately
let latestPrice = 100;
let latestTickCount = 0;

export function setCurrentPriceForWS(price: number, tickCount: number): void {
  latestPrice = price;
  latestTickCount = tickCount;
}

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    // Send current price immediately on connect
    const priceB = Math.max(0.01, 2 * BASE_PRICE - latestPrice);
    ws.send(JSON.stringify({
      type: 'CANDLE',
      data: {
        time: tickToTimestamp(latestTickCount),
        tickCount: latestTickCount,
        open: latestPrice,
        high: latestPrice,
        low: latestPrice,
        close: latestPrice,
        volume: 0,
        price: latestPrice,
        priceB,
      },
    }));

    // Mark connection as alive for heartbeat
    (ws as any).isAlive = true;
    ws.on('pong', () => {
      (ws as any).isAlive = true;
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  // Heartbeat: ping all clients every 30s, terminate dead ones
  heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if ((ws as any).isAlive === false) {
        ws.terminate();
        continue;
      }
      (ws as any).isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  console.log('[WS] WebSocket server initialized on /ws');
  return wss;
}

export function broadcastCandle(candle: ServerCandle, currentPrice: number, tickCount: number): void {
  if (!wss) return;

  const priceB = Math.max(0.01, 2 * BASE_PRICE - currentPrice);

  const message = JSON.stringify({
    type: 'CANDLE',
    data: {
      ...candle,
      tickCount,
      price: currentPrice,
      priceB,
    },
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function broadcastPrice(priceA: number): void {
  if (!wss) return;

  const priceB = Math.max(0.01, 2 * BASE_PRICE - priceA);

  const message = JSON.stringify({
    type: 'PRICE',
    data: { price: priceA, priceB },
  });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function broadcastAnalysis(data: {
  bandMeans: number[];
  bandStds: number[];
  diceGrid: number[];
  shortInterest: number;
  utilization: number;
  bookSnapshot: { bids: any[]; asks: any[]; bestBid: number | null; bestAsk: number | null; spread: number | null };
  F_t: number;
}): void {
  if (!wss) return;

  const message = JSON.stringify({ type: 'ANALYSIS', data });

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

export function getClientCount(): number {
  if (!wss) return 0;
  let count = 0;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) count++;
  }
  return count;
}
