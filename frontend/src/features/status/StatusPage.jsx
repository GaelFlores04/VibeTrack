import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';
export default function StatusPage() {
  const resource = useResource('/health');
  return <><h1>Estado del sistema</h1><ResourceState resource={resource}>{resource.data && <dl><dt>API</dt><dd>{resource.data.status === 'ok' ? 'En funcionamiento' : 'No disponible'}</dd><dt>MongoDB</dt><dd>{resource.data.database === 'connected' ? 'Conectado' : 'Pendiente de configurar'}</dd><dt>Last.fm</dt><dd>{resource.data.providers.lastfm === 'configured' ? 'Clave configurada; conexión por comprobar' : 'Pendiente de clave'}</dd><dt>Deezer</dt><dd>Previews y búsqueda (sin clave); iTunes como respaldo</dd><dt>ReccoBeats</dt><dd>{resource.data.providers.reccobeats === 'enabled' ? 'Clasificación del mood por rasgos de audio activa' : 'Desactivado: se usan sólo etiquetas'}</dd></dl>}</ResourceState><p>Esta primera entrega permite navegar, buscar música y escuchar previews. Cuentas, favoritos, calificaciones e historial están pendientes.</p></>;
}
