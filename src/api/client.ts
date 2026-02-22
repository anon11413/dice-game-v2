const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }

    return res.json();
  }

  // Auth
  register(username: string, password: string) {
    return this.request<{ token: string; user: any }>('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  login(username: string, password: string) {
    return this.request<{ token: string; user: any }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  // Data
  getHistory(limit?: number, resolution?: number) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (resolution) params.set('resolution', String(resolution));
    const query = params.toString();
    return this.request<{ candles: any[] }>(`/history${query ? `?${query}` : ''}`);
  }

  getPrice() {
    return this.request<{ price: number; priceB: number; timestamp: string }>('/price');
  }

  // User
  getMe() {
    return this.request<{ user: any }>('/me');
  }

  getTradeHistory(limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<{ trades: any[] }>(`/trades${query}`);
  }

  // Trading
  trade(asset: 'A' | 'B', side: 'BUY' | 'SELL', quantity: number) {
    return this.request<{ trade: any; portfolio: any }>('/trade', {
      method: 'POST',
      body: JSON.stringify({ asset, side, quantity }),
    });
  }

  // Settings
  resetAccount() {
    return this.request<{ user: any; message: string }>('/settings/reset', {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
