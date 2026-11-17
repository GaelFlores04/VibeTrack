import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { mutate } from '../../shared/services/api';

const SOURCES = [
  { value: 'both', label: 'Ambos', hint: 'Tus artistas y géneros de la app más lo que escuchas en Spotify.' },
  { value: 'app', label: 'Solo la app', hint: 'Sólo las preferencias que configuraste aquí. Spotify sigue sirviendo para escuchar completas.' },
  { value: 'spotify', label: 'Solo Spotify', hint: 'Sólo lo que más escuchas en Spotify; ignora tus preferencias de la app.' },
];
const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' });

function SpotifySection() {
  const { spotify } = usePlayer();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const connection = spotify.connection;

  // Regreso desde Spotify: ?spotify=conectado | error&motivo=…
  useEffect(() => {
    const result = params.get('spotify');
    if (!result) return;
    if (result === 'conectado') { setNotice('Spotify conectado. Estamos leyendo lo que más escuchas para afinar tus recomendaciones.'); void spotify.refresh(); setTimeout(() => void spotify.refresh(), 4000); }
    else setError(params.get('motivo') || 'No se pudo conectar Spotify.');
    setParams({}, { replace: true });
  }, []);

  async function run(kind, action) {
    setBusy(kind); setError(''); setNotice('');
    try { await action(); } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  const connect = () => run('connect', async () => { const { url } = await mutate('/spotify/connect', 'POST'); window.location.assign(url); });
  const importNow = () => run('import', async () => { const { artists } = await mutate('/spotify/import', 'POST'); await spotify.refresh(); setNotice(artists.length ? `Actualizado: ${artists.join(', ')}.` : 'Spotify todavía no tiene suficiente historial tuyo.'); });
  const chooseSource = source => run('source', async () => { await mutate('/spotify/source', 'POST', { source }); await spotify.refresh(); setNotice('Listo: las próximas tandas usarán esta fuente de gustos.'); });
  const disconnect = () => run('disconnect', async () => { await mutate('/spotify', 'DELETE'); await spotify.refresh(); setNotice('Spotify desconectado. Borramos el acceso y tus artistas importados.'); });

  if (!connection) return null;
  if (!connection.configured) return <section className="spotify-link" aria-labelledby="spotify-title">
    <h2 id="spotify-title">Spotify</h2>
    <p>La conexión con Spotify no está activada en este servidor.</p>
  </section>;
  return <section className="spotify-link" aria-labelledby="spotify-title">
    <h2 id="spotify-title">Spotify</h2>
    {connection.connected ? <>
      <p>Conectado{connection.connectedAt ? ` desde el ${dateFormat.format(new Date(connection.connectedAt))}` : ''}. Con Premium, las canciones suenan completas en este navegador.
        {spotify.status === 'loading' && ' Preparando el reproductor…'}
        {spotify.status === 'ready' && ' Reproductor listo.'}</p>
      {spotify.status === 'error' && <p role="alert">{spotify.message}</p>}
      {connection.topArtists?.length > 0 && <p>Lo que más escuchas: {connection.topArtists.join(', ')}.</p>}
      <fieldset className="taste-source" disabled={!!busy}>
        <legend>¿Qué gustos usamos para recomendarte?</legend>
        {SOURCES.map(option => <label key={option.value}>
          <input type="radio" name="taste-source" value={option.value} checked={(connection.tasteSource || 'both') === option.value} onChange={() => chooseSource(option.value)} />
          <span><strong>{option.label}</strong><small>{option.hint}</small></span>
        </label>)}
      </fieldset>
      <p className="row-actions">
        <button type="button" onClick={importNow} disabled={!!busy}>{busy === 'import' ? 'Actualizando…' : 'Actualizar desde Spotify'}</button>
        <button type="button" onClick={disconnect} disabled={!!busy}>{busy === 'disconnect' ? 'Desconectando…' : 'Desconectar'}</button>
      </p>
      {connection.expiresAt && <p className="hint">Spotify pide volver a conectar cada seis meses (próxima vez: {dateFormat.format(new Date(connection.expiresAt))}).</p>}
    </> : <>
      <p>Conecta tu cuenta de Spotify Premium para escuchar las canciones completas y que tus recomendaciones partan de lo que más escuchas. Sin Premium seguimos con los previews de 30 s.</p>
      <p><button type="button" className="primary" onClick={connect} disabled={!!busy}>{busy === 'connect' ? 'Abriendo Spotify…' : 'Conectar Spotify'}</button></p>
    </>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function exit() { setBusy(true); setError(''); try { await logout(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <><h1>Tu cuenta</h1><p>{user.name} · {user.email}</p><p>{user.preferences ? 'Tus recomendaciones tienen en cuenta tus preferencias dentro del mood que elijas.' : 'Todavía no hay preferencias. Escucharás una selección inicial de canciones conocidas por mood.'}</p>
    <p><Link to="/preferencias">Configurar preferencias</Link> · <Link to="/moods">Elegir un mood</Link></p>
    <SpotifySection />
    {error && <p role="alert">{error}</p>}<button onClick={exit} disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar sesión'}</button></>;
}
