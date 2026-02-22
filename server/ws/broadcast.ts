import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { ServerCandle } from '../engine/ServerEngine.js';

const BASE_PRICE = 100;

let wss: WebSocketServer;

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    // Send current state on connect
    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
    });
  });

  console.log('[WS] WebSocket server initialized on /ws');
  return wss;
}

export function broadcastCandle(candle: ServerCandle, currentPrice: number): void {
  if (!wss) return;

  const priceB = Math.max(0.01, 2 * BASE_PRICE - currentPrice);

  const message = JSON.stringify({
    type: 'CANDLE',
    data: {
      ...candle,
      price: currentPrice,
      priceB,
    },
  });

  let sent = 0;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  }

  if (sent > 0) {
    console.log(`[WS] Broadcast candle to ${sent} client(s)`);
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

export function getClientCount(): number {
  if (!wss) return 0;
  let count = 0;
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) count++;
  }
  return count;
}
