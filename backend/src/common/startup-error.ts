import { redactError } from './api-exception.filter';

// Los drivers anidan la causa TLS/DNS dentro de la topología; nunca imprimimos ese objeto.
export function startupError(error: unknown): string {
  const codes = new Set<string>();
  const visited = new Set<object>();
  function inspect(value: unknown) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    const item = value as { code?: unknown; cause?: unknown; reason?: unknown; error?: unknown; servers?: unknown };
    if (typeof item.code === 'string') codes.add(item.code);
    inspect(item.cause); inspect(item.reason); inspect(item.error);
    if (item.servers instanceof Map) for (const server of item.servers.values()) inspect(server);
  }
  inspect(error);
  if (codes.has('EADDRINUSE')) return 'El puerto de la API ya está ocupado. Cierra la otra instancia de VibeTrack o configura otro PORT.';
  if ([...codes].some(code => /^ERR_(SSL|TLS)_/.test(code))) {
    return 'Falló la conexión TLS con MongoDB. Revisa en Atlas que tu IP actual esté autorizada en Network Access y que el clúster esté activo. Si persiste, revisa VPN, firewall o filtros de red. Diagnóstico: node backend/scripts/check-services.cjs --mongo-only (desde la raíz del proyecto).';
  }
  if ([...codes].some(code => ['ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ESERVFAIL', 'EREFUSED'].includes(code))) {
    return 'No se pudo resolver el servidor de MongoDB. Revisa el host configurado y la resolución DNS de la red.';
  }
  return error instanceof Error ? redactError(error.message) : 'Error de arranque sin detalle disponible.';
}
