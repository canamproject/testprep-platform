const BASE = '/api';

function getToken() {
  return localStorage.getItem('tp_token');
}

export function setToken(token) {
  localStorage.setItem('tp_token', token);
}

export function clearToken() {
  localStorage.removeItem('tp_token');
  localStorage.removeItem('tp_user');
}

async function request(path, options = {}) {
  const token = getToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request timed out. Please check your connection.');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
