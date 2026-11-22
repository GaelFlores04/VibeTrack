export async function api(path, signal, options = {}) {
  const response = await fetch(`/api${path}`, { ...options, signal, credentials: 'same-origin', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.method && options.method !== 'GET' ? { 'X-VibeTrack': '1' } : {}), ...options.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(Array.isArray(body?.message) ? body.message.join('. ') : body?.message || 'No se pudo contactar con la API.');
    error.status = response.status;
    throw error;
  }
  return body;
}
export const mutate = (path, method, body) => api(path, undefined, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
