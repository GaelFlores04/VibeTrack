import { useState } from 'react';
import { usePlayer } from '../player/PlayerProvider';
import { mutate } from '../../shared/services/api';
import ActionLink from '../../shared/components/ActionLink';

const SOURCES = [
  { value: 'app', label: 'VibeTrack', hint: 'Tus artistas, géneros y lo que escuchas aquí.' },
  { value: 'spotify', label: 'Spotify', hint: 'Lo que más escuchas en Spotify, sin usar el cuestionario de VibeTrack.' },
  { value: 'both', label: 'Ambos', hint: 'Combina tus gustos de VibeTrack con lo que escuchas en Spotify.' },
];

export default function TasteSourceSection() {
  const { spotify } = usePlayer();
  const { connection } = spotify;
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function run(kind, action) {
    setBusy(kind); setError(''); setNotice('');
    try { await action(); } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  const chooseSource = source => run('source', async () => {
    await mutate('/spotify/source', 'POST', { source });
    const updated = await spotify.refresh();
    setNotice(updated ? 'Fuente guardada. Se aplicará a tus próximas tandas.' : 'Fuente guardada. No pudimos actualizar su estado; vuelve a consultarlo.');
  });
  const importNow = () => run('import', async () => {
    const { artists, sources = [] } = await mutate('/spotify/import', 'POST');
    await spotify.refresh();
    const incomplete = sources.some(source => source.status !== 'ready');
    setNotice(incomplete ? 'Importación parcial. Revisa las fuentes pendientes abajo; conservamos sus últimos datos disponibles.' : artists.length ? 'Tus gustos de Spotify se actualizaron. Se aplicarán a las próximas tandas.' : 'La consulta terminó, pero Spotify todavía no tiene suficientes datos de tus gustos.');
  });

  return <section className="spotify-link" aria-labelledby="taste-source-title">
    <h2 id="taste-source-title">De dónde vienen tus gustos</h2>
    {!connection ? <p>Consultando la vinculación con Spotify… <button type="button" disabled={!!busy} onClick={() => run('refresh', async () => { if (!await spotify.refresh()) throw new Error('No se pudo consultar Spotify. Reintenta en unos momentos.'); })}>Volver a consultar</button></p>
      : connection.connected ? <>
        <fieldset className="taste-source" disabled={!!busy}>
          <legend>¿Qué gustos usamos para recomendarte?</legend>
          {SOURCES.map(option => <label key={option.value}>
            <input type="radio" name="taste-source" value={option.value} checked={(connection.tasteSource || 'both') === option.value} onChange={() => chooseSource(option.value)} />
            <span><strong>{option.label}</strong><small>{option.hint}</small></span>
          </label>)}
        </fieldset>
        {connection.topArtists?.length > 0 && <p>Entre tus artistas de Spotify: {connection.topArtists.slice(0, 5).join(', ')}.</p>}
        {!!connection.missingScopes?.length && <p>Para leer canciones guardadas y artistas seguidos, actualiza los permisos desde <ActionLink to="/cuenta#vinculaciones" icon="user">Vinculaciones</ActionLink>.</p>}
        <details className="spotify-import-details"><summary>Datos de Spotify utilizados</summary>
          <p>Combinamos escuchas recientes y habituales, artistas que sigues y canciones guardadas. Guardar una canción en Spotify no nos dice para qué mood te gusta.</p>
          {connection.importedAt && <p>Última actualización: {new Date(connection.importedAt).toLocaleString('es')}.</p>}
          {!connection.importSources?.length && <p>Actualiza tus gustos para consultar las nuevas fuentes.</p>}
          <ul>{connection.importSources?.map(source => <li key={source.id}><strong>{source.label}</strong><span>{source.status === 'ready' ? `${source.count} elementos${source.capped ? ' · muestra limitada' : ''}` : source.status === 'missing-permission' ? 'Falta autorizar el permiso' : 'No disponible · conservamos la lectura anterior'}</span></li>)}</ul>
          {!!connection.topArtists?.length && <p>Artistas que orientan tu perfil: {connection.topArtists.join(', ')}.</p>}
          {!!connection.topTracks?.length && <><h3>Algunas canciones de tu perfil</h3><ul>{connection.topTracks.map((track, index) => <li key={`${track.artist}:${track.title}:${index}`}>{track.title} · {track.artist}</li>)}</ul></>}
        </details>
        {connection.tasteSource === 'spotify' && <p>Tu cuestionario queda guardado para cuando elijas VibeTrack o Ambos.</p>}
        <p className="row-actions"><button type="button" onClick={importNow} disabled={!!busy}>{busy === 'import' ? 'Actualizando…' : 'Actualizar gustos de Spotify'}</button></p>
      </> : <>
        <p>Usamos tus gustos de VibeTrack. {connection.configured ? 'Vincula Spotify desde Cuenta para elegir Spotify o combinar ambos.' : 'La vinculación con Spotify no está disponible en este servidor.'}</p>
        <ActionLink to="/cuenta#vinculaciones" icon="user">Ir a vinculaciones</ActionLink>
      </>}
    <p className="hint">Tu nivel de preferencia, tus exclusiones y tus valoraciones se respetan con cualquier fuente. Esta elección no cambia cómo reproduces la música.</p>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
