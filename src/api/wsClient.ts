type WSHandler = (data: any) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<WSHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;

  connect(_token?: string | null): void {
    this.shouldReconnect = true;
    this.doConnect();
  }

  private doConnect(): void {
    // Clean up old connection
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.emit('connected', {});
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.emit(msg.type, msg.data);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.doConnect(), 3000);
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  on(type: string, handler: WSHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  private emit(type: string, data: any): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    // Clear all listeners to prevent leaks
    this.listeners.clear();
  }
}

export const wsClient = new WSClient();
