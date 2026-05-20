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

// Auto-retry helper — used for 502/503 (server cold start)
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function request(path, options = {}, _retries = 5) {
  const token = getToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
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

    // 502/503 = server cold-starting on Railway — auto-retry up to 3×
    if ((res.status === 502 || res.status === 503) && _retries > 0) {
      clearTimeout(timeoutId);
      await sleep(5000); // wait 5s between retries
      return request(path, options, _retries - 1);
    }

    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') {
      if (_retries > 0) {
        clearTimeout(timeoutId);
        await sleep(4000);
        return request(path, options, _retries - 1);
      }
      throw new Error('Server is not responding. Please check your connection and try again.');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get:    (path)        => request(path),
  post:   (path, body)  => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    (path, body)  => request(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: (path)        => request(path, { method: 'DELETE' }),
};
