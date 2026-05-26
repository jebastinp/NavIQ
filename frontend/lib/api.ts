import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const auth = await authHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...auth, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API ${res.status}: ${txt}`);
  }
  return res.json();
}

export const apiOptimize = (body: any) => api('/optimize', { method: 'POST', body: JSON.stringify(body) });
export const apiGeocodeBatch = (items: any[]) => api('/geocode/batch', { method: 'POST', body: JSON.stringify({ items }) });
export const apiHealth = () => api('/health');
