import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { usePlayer } from '../player/PlayerProvider';
import { mutate } from '../../shared/services/api';

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
  const disconnect = () => run('disconnect', async () => { await mutate('/spotify', 'DELETE'); await spotify.refresh(); setNotice('Spotify desconectado. Borramos el acceso y tus artistas importados.'); });

  if (!connection) return <p>Consultando tus vinculaciones… <button type="button" disabled={!!busy} onClick={() => run('refresh', () => spotify.refresh())}>Volver a consultar</button></p>;
  if (!connection.configured) return <section className="spotify-link" aria-labelledby="spotify-title">
    <h3 id="spotify-title">Spotify</h3>
    <p>La conexión con Spotify no está activada en este servidor.</p>
  </section>;
  return <section className="spotify-link" aria-labelledby="spotify-title">
    <h3 id="spotify-title">Spotify</h3>
    {connection.connected ? <>
      <p>Conectado{connection.connectedAt ? ` desde el ${dateFormat.format(new Date(connection.connectedAt))}` : ''}. Con Premium, las canciones suenan completas en este navegador.
        {spotify.status === 'loading' && ' Preparando el reproductor…'}
        {spotify.status === 'ready' && ' Reproductor listo.'}</p>
      {spotify.status === 'error' && <p role="alert">{spotify.message}</p>}
      <p>Elige cómo usar tus gustos de Spotify en <Link to="/preferencias">Preferencias</Link>.</p>
      <p className="row-actions">
        {!!connection.missingScopes?.length && <button type="button" onClick={connect} disabled={!!busy}>{busy === 'connect' ? 'Abriendo Spotify…' : 'Actualizar permisos de Spotify'}</button>}
        <button type="button" onClick={disconnect} disabled={!!busy}>{busy === 'disconnect' ? 'Desvinculando…' : 'Desvincular Spotify'}</button>
      </p>
      {connection.expiresAt && <p className="hint">Spotify pide volver a conectar cada seis meses (próxima vez: {dateFormat.format(new Date(connection.expiresAt))}).</p>}
    </> : <>
      <p>Conecta tu cuenta de Spotify Premium para escuchar las canciones completas y que tus recomendaciones partan de lo que más escuchas. Sin Premium seguimos con los previews de 30 s.</p>
      <p><button type="button" className="primary" onClick={connect} disabled={!!busy}>{busy === 'connect' ? 'Abriendo Spotify…' : 'Vincular Spotify'}</button></p>
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
    <section id="vinculaciones" aria-labelledby="connections-title">
      <h2 id="connections-title">Vinculaciones</h2>
      <SpotifySection />
    </section>
    {error && <p role="alert">{error}</p>}<button onClick={exit} disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar sesión'}</button></>;
}
