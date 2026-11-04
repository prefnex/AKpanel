// Thin JSON client shared by every page. Adds the session token for the active panel,
// normalises error messages and signals expired sessions to the app shell.

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function tokenFor(url) {
  try {
    if (url.startsWith('/api/client/')) {
      return localStorage.getItem('akpanel_client_token') || localStorage.getItem('ak_client_token');
    }
    return localStorage.getItem('ak_token');
  } catch {
    return null;
  }
}

function messageFrom(body, status) {
  if (body && typeof body === 'object') {
    return body.message || body.error || `Request failed (${status})`;
  }
  if (typeof body === 'string' && body.trim()) return body.slice(0, 300);
  return `Request failed (${status})`;
}

export async function request(url, { method = 'GET', body, headers, signal, raw = false } = {}) {
  const h = new Headers(headers || {});
  const token = tokenFor(url);
  if (token && !h.has('Authorization')) h.set('Authorization', `Bearer ${token}`);

  let payload = body;
  if (body !== undefined && !(body instanceof FormData) && typeof body !== 'string') {
    h.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers: h, body: payload, signal });
  if (raw) return res;

  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response; keep text */
  }

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('akpanel:unauthorized', { detail: { url } }));
  }
  // Several legacy endpoints answer 200 with {status:false}; treat them as errors too.
  const softFail = data && typeof data === 'object' && (data.status === false || data.status === 'error');
  if (!res.ok || softFail) {
    throw new ApiError(messageFrom(data, res.status), res.status, data);
  }
  return data;
}

export const api = {
  get: (url, opts) => request(url, { ...opts, method: 'GET' }),
  post: (url, body, opts) => request(url, { ...opts, method: 'POST', body }),
  put: (url, body, opts) => request(url, { ...opts, method: 'PUT', body }),
  del: (url, body, opts) => request(url, { ...opts, method: 'DELETE', body }),
};
