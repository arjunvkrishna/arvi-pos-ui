const API_BASE = '/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private activeOutletId: number | null = null;

  constructor() {
    this.token = localStorage.getItem('pos_token');
    this.refreshToken = localStorage.getItem('pos_refresh_token');
    const storedOutlet = localStorage.getItem('pos_active_outlet_id');
    if (storedOutlet) {
      this.activeOutletId = parseInt(storedOutlet, 10);
    }
  }

  setToken(token: string | null, refreshToken?: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('pos_token', token);
    } else {
      localStorage.removeItem('pos_token');
    }

    if (refreshToken !== undefined) {
      this.refreshToken = refreshToken;
      if (refreshToken) {
        localStorage.setItem('pos_refresh_token', refreshToken);
      } else {
        localStorage.removeItem('pos_refresh_token');
      }
    }
  }

  setActiveOutletId(outletId: number | null) {
    this.activeOutletId = outletId;
    if (outletId !== null) {
      localStorage.setItem('pos_active_outlet_id', outletId.toString());
    } else {
      localStorage.removeItem('pos_active_outlet_id');
    }
  }

  getActiveOutletId(): number | null {
    return this.activeOutletId;
  }

  getToken(): string | null {
    return this.token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.token) {
        this.setToken(data.token, data.refreshToken || this.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers: customHeaders, ...rest } = options;

    let url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) searchParams.append(k, String(v));
      });
      const qs = searchParams.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.activeOutletId) {
      headers['X-Outlet-Id'] = this.activeOutletId.toString();
    }

    let response = await fetch(url, { ...rest, headers });

    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed && this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
        response = await fetch(url, { ...rest, headers });
      } else {
        this.setToken(null, null);
        window.dispatchEvent(new Event('auth:unauthorized'));
        throw new Error('Session expired. Please log in again.');
      }
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || err.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) return null as unknown as T;
    return response.json();
  }

  /** Multipart upload (images). No JSON content type: the browser sets the multipart boundary itself. */
  async upload<T = any>(endpoint: string, file: File, method: 'PUT' | 'POST' = 'PUT'): Promise<T> {
    const form = new FormData();
    form.append('file', file);
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (this.activeOutletId) headers['X-Outlet-Id'] = this.activeOutletId.toString();
    const response = await fetch(`${API_BASE}${endpoint}`, { method, headers, body: form });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(err.message || err.error || `HTTP ${response.status}`);
    }
    return response.json();
  }

  /** Fetches an image that needs the login (e.g. the payment QR) and returns a temporary URL for <img>. */
  async imageUrl(endpoint: string): Promise<string | null> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (this.activeOutletId) headers['X-Outlet-Id'] = this.activeOutletId.toString();
    const response = await fetch(`${API_BASE}${endpoint}`, { headers });
    if (!response.ok) return null;
    return URL.createObjectURL(await response.blob());
  }

  get<T = any>(endpoint: string, params?: Record<string, any>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  post<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) });
  }

  patch<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'PATCH', body: data === undefined ? undefined : JSON.stringify(data) });
  }

  put<T = any>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  }

  delete<T = any>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
