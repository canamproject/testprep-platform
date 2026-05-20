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

// Single attempt — no internal retry.
// Callers that need retry (e.g. Login page) handle it themselves with
// visible feedback. Background GET calls retry once silently.
async function request(path, options = {}, _retries = 1) {
  const token = getToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s per attempt
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

    // 502/503 = server restarting — retry once silently for background calls
    if ((res.status === 502 || res.status === 503) && _retries > 0) {
      clearTimeout(timeoutId);
      await new Promise(r => setTimeout(r, 4000));
      return request(path, options, _retries - 1);
    }

    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      if (_retries > 0) {
        await new Promise(r => setTimeout(r, 4000));
        return request(path, options, _retries - 1);
      }
      throw new Error('SERVER_TIMEOUT');
    }
    // Propagate 502 as a recognisable code so callers can retry with UI
    if (e.message && (e.message.includes('502') || e.message.includes('503'))) {
      throw new Error('SERVER_UNAVAILABLE');
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
