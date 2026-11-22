import { useResource } from '../../shared/hooks/useResource';
import ResourceState from '../../shared/components/ResourceState';

// Cuadro eléctrico: un interruptor por servicio, con su piloto encendido cuando tiene corriente.
// Mismos datos y textos de siempre; el estado se lee en el propio interruptor.
function Breaker({ name, on, children }) {
  return <li className={`breaker${on ? ' is-on' : ''}`}>
    <span className="breaker-switch" aria-hidden="true"><span /></span>
    <span className="breaker-pilot" aria-hidden="true" />
    <strong>{name}</strong>
    <span className="breaker-state"><span className="visually-hidden">{on ? 'Con corriente: ' : 'Sin corriente: '}</span>{children}</span>
  </li>;
}

export default function StatusPage() {
  const resource = useResource('/health');
  const data = resource.data;
  return <section className="fuse-room" aria-labelledby="status-title">
    <h1 id="status-title">Cuadro eléctrico</h1>
    <p className="room-purpose">Qué servicios del estudio tienen corriente ahora mismo.</p>
    <ResourceState resource={resource}>{data && <div className="fuse-box">
      <ul className="breaker-panel" aria-label="Servicios">
        <Breaker name="API" on={data.status === 'ok'}>{data.status === 'ok' ? 'En funcionamiento' : 'No disponible'}</Breaker>
        <Breaker name="MongoDB" on={data.database === 'connected'}>{data.database === 'connected' ? 'Conectado' : 'Pendiente de configurar'}</Breaker>
        <Breaker name="Last.fm" on={data.providers.lastfm === 'configured'}>{data.providers.lastfm === 'configured' ? 'Clave configurada; conexión por comprobar' : 'Pendiente de clave'}</Breaker>
        <Breaker name="Deezer" on>Previews y búsqueda (sin clave); iTunes como respaldo</Breaker>
        <Breaker name="ReccoBeats" on={data.providers.reccobeats === 'enabled'}>{data.providers.reccobeats === 'enabled' ? 'Clasificación del mood por rasgos de audio activa' : 'Desactivado: se usan sólo etiquetas'}</Breaker>
      </ul>
    </div>}</ResourceState>
    <p className="fuse-note">Esta primera entrega permite navegar, buscar música y escuchar previews. Cuentas, favoritos, calificaciones e historial están pendientes.</p>
  </section>;
}
