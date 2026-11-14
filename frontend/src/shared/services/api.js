export async function api(path, signal) {
  const response = await fetch(`/api${path}`, { signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(Array.isArray(body?.message) ? body.message.join('. ') : body?.message || 'No se pudo contactar con la API.');
  return body;
}
