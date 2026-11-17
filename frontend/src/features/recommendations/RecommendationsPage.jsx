import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { formatTime, usePlayer } from '../player/PlayerProvider';
import PlayerStage from '../player/PlayerStage';
import { formatDuration, isBlankTrack, reasonTag } from '../player/trackState';
import Disc from '../../shared/components/Disc';
import PlaybackDisc from '../../shared/components/PlaybackDisc';
import Icon from '../../shared/components/Icon';
import ActionLink from '../../shared/components/ActionLink';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion';
import { useRecommendations } from './useRecommendations';
import { useSongFeedback } from './useSongFeedback';
import SongFeedback from './SongFeedback';

const moodNames = { feliz: 'Feliz', relajado: 'Relajado', motivado: 'Motivado', triste: 'Triste', romantico: 'Romántico', cansado: 'Cansado' };

export default function RecommendationsPage() {
  const { mood } = useParams();
  const { user, loading, version } = useAuth();
  if (loading) return <p role="status">Preparando tu selección…</p>;
  return <MoodRecommendations key={`${mood}:${version}`} mood={mood} user={user} />;
}

function MoodRecommendations({ mood, user }) {
  const feedback = useSongFeedback(mood, user?.id);
  const [params, setParams] = useSearchParams();
  const initialPage = Math.min(100, Math.max(1, Number.parseInt(params.get('tanda'), 10) || 1));
  const resource = useRecommendations(mood, { owner: user?.id || 'guest', initialPage });
  const player = usePlayer();
  const reduced = useReducedMotion();
  const heading = useRef(null);
  const list = useRef(null);
  const shownPage = useRef(0);
  const autoplay = useRef(false);
  const [selectedId, setSelectedId] = useState(null);
  const { batch, page } = resource;
  const ready = batch?.status === 'ready';
  const tracks = batch?.tracks || [];
  const moodName = moodNames[mood] || mood;
  const personalized = batch ? batch.mode === 'personalized' : Boolean(user?.preferences);
  const source = useMemo(() => page ? { key: `mood:${mood}:${page}`, label: `${moodName} · tanda ${page}`, path: `/recomendaciones/${mood}${page > 1 ? `?tanda=${page}` : ''}` } : null, [mood, moodName, page]);
  const owns = !!source && player.source?.key === source.key;

  // Selección: la canción que suena si esta tanda es la cola; si no, la primera.
  const selected = tracks.find(track => track.id === selectedId) || (owns && tracks.find(track => track.id === player.track?.id)) || tracks[0] || null;
  const selectedIndex = tracks.findIndex(track => track.id === selected?.id);
  const isLoaded = owns && player.track?.id === selected?.id;
  const playing = isLoaded && player.status === 'playing';
  // Con Spotify Premium conectado, cada canción de la tanda se busca en Spotify para sonar completa.
  const [, setMatched] = useState(0);
  const spotifyReady = player.spotify.ready;
  useEffect(() => {
    if (!spotifyReady || !tracks.length) return;
    let live = true;
    player.spotify.match(tracks).then(() => { if (live) setMatched(value => value + 1); }).catch(() => {});
    return () => { live = false; };
  }, [spotifyReady, batch]);
  const full = !!selected && spotifyReady && !!player.spotify.uriFor(selected.id);
  const blank = isBlankTrack(selected) && !full;

  useEffect(() => { if (owns && player.track) setSelectedId(player.track.id); }, [owns, player.track?.id]);
  useEffect(() => { if (source && tracks.length) player.syncQueue(source.key, tracks); }, [tracks, source?.key]);
  // En esta página el reproductor completo sustituye siempre al mini: si suena otra lista, la barra
  // de la página lo indica (antes ambos se superponían y mostraban canciones distintas).
  useEffect(() => { player.setDocked('*'); return () => player.setDocked(null); }, []);
  const elsewhere = !owns && player.track;
  const elsewherePlaying = elsewhere && ['playing', 'loading'].includes(player.status);

  // La tanda visible queda en la URL; al cambiar de tanda se vuelve arriba, a la primera canción.
  useEffect(() => {
    if (!page) return;
    if (String(page) !== (params.get('tanda') || '1')) setParams(page > 1 ? { tanda: String(page) } : {}, { replace: true });
    if (shownPage.current && shownPage.current !== page) {
      setSelectedId(null);
      heading.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
      heading.current?.focus({ preventScroll: true });
    }
    shownPage.current = page;
  }, [page]);

  // Al cambiar de tanda dentro de este mood, el reproductor sigue a la tanda visible: si sonaba (o la
  // cola había terminado) empieza la nueva; si estaba en pausa, queda cargada en pausa. Antes el mini
  // seguía con la canción anterior mientras el principal mostraba la nueva y no sonaba ninguna.
  // Va antes del autoplay: si el final de la cola pidió continuar, ese efecto se encarga.
  useEffect(() => {
    if (!ready || !source || owns || autoplay.current || !tracks.length) return;
    if (!player.source?.key?.startsWith(`mood:${mood}:`)) return;
    const first = tracks.find(player.playable);
    if (['playing', 'loading', 'ended'].includes(player.status)) {
      if (first) player.playQueue(tracks, first, source); // sin previews aún: se reintenta al llegar
    } else player.loadQueue(tracks, first || tracks[0], source);
  }, [batch, source?.key, owns]);

  // Tras "continuar" al final de la cola, la nueva tanda empieza sola en cuanto tenga previews.
  useEffect(() => {
    if (!autoplay.current || !ready || !source) return;
    const first = tracks.find(player.playable);
    if (!first) return;
    autoplay.current = false;
    player.playQueue(tracks, first, source);
  }, [batch, source]);

  const nextRef = useRef(resource.next);
  nextRef.current = resource.next;
  useEffect(() => {
    if (!source || resource.exhausted && !resource.hasNewer) return;
    return player.registerEndAction(source.key, { label: resource.hasNewer ? 'Siguiente tanda' : 'Otras 7 canciones', run: () => { autoplay.current = true; nextRef.current(); } });
  }, [source?.key, resource.exhausted, resource.hasNewer]);

  // Cuando la reproducción avanza sola, la lista acompaña a la canción en curso.
  useEffect(() => {
    if (!owns || player.lastChange !== 'auto' || !player.track) return;
    list.current?.querySelector(`[data-track-id="${CSS.escape(player.track.id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [player.track?.id]);

  // D04: elegir desde la pila o la lista cambia el CD del lector; una sola pista activa.
  function pick(track) {
    setSelectedId(track.id);
    if (player.playable(track) && source) player.playQueue(tracks, track, source);
    else if (owns) player.pause();
  }
  function togglePlay() {
    if (!player.playable(selected)) return;
    if (isLoaded) player.toggle(); else player.playQueue(tracks, selected, source);
  }
  const move = direction => { const next = tracks[selectedIndex + direction]; if (next) pick(next); };

  const lcdState = !selected ? 'VACÍO' : blank ? 'SIN PREVIEW' : !isLoaded ? (full ? 'COMPLETA' : 'LISTO') : player.status === 'loading' ? 'CARGANDO' : playing ? 'PLAY' : 'PAUSA';
  const current = isLoaded ? player.time.current : 0;
  const duration = isLoaded && Number.isFinite(player.time.duration) && player.time.duration ? player.time.duration : full ? (selected.durationMs || 30000) / 1000 : 30;
  const stageLabel = selected ? `Reproductor con el CD de ${selected.title}, de ${selected.artist}. ${blank ? 'Sin preview.' : playing ? 'Sonando.' : 'Detenido.'} La pila tiene ${Math.max(0, tracks.length - 1)} CDs más.` : 'Reproductor vacío.';

  return <div className="rec-page">
    <div className="rec-head">
      <div>
        <h1>{moodName}</h1>
        <p className="lede">{personalized ? 'Sobre todo tus artistas, más similares y tus géneros, y algún descubrimiento que encaje con este mood.' : 'Canciones conocidas para acompañar este mood.'} <Link to={user ? '/preferencias' : '/registro'}>{user ? 'Cambiar preferencias' : 'Personalizar con una cuenta'}</Link></p>
      </div>
      <nav className="batch-nav" aria-label="Tandas">
        <button type="button" disabled={resource.loading || page <= 1} onClick={resource.previous}><span className="long">Tanda anterior</span><span className="short">Anterior</span></button>
        {page > 0 && <span className="lcd-text batch-count" aria-live="polite">Tanda {page}</span>}
        <button type="button" className="primary" disabled={resource.loading || (resource.exhausted && !resource.hasNewer)} onClick={resource.next}>
          {resource.loading ? 'Preparando…' : resource.hasNewer ? 'Siguiente tanda' : resource.message || resource.error ? 'Reintentar tanda' : batch ? <><span className="long">Otras 7 canciones</span><span className="short">Otras 7</span></> : 'Preparar selección'}
        </button>
      </nav>
    </div>

    {resource.loading && <p role="status" className="rec-status">{batch ? 'Preparando la tanda. Puedes seguir escuchando esta.' : 'Preparando 7 recomendaciones…'}</p>}
    {resource.notice && <p role="status" className="rec-status rec-notice">{resource.notice}</p>}
    {resource.message && <p role="status" className="rec-status">{resource.message}</p>}
    {resource.error && <p role="alert" className="rec-status">{resource.error}</p>}

    {batch && <div className="rec-layout">
      <section className="rec-stage" aria-labelledby="stage-title">
        <h2 id="stage-title" ref={heading} tabIndex="-1" className="visually-hidden">{ready ? `Tanda ${batch.page}` : 'Tanda parcial'}</h2>
        <p className="stack-count lcd-text">{tracks.length} CDs · 1 en el lector{batch.previewsPending ? ' · buscando previews' : ''}</p>
        <PlayerStage tracks={tracks} selected={selected} playing={playing} reduced={reduced} onPick={pick} label={stageLabel}
          lcd={selected && <div className="lcd" role="status" aria-live="off" aria-label={`Pantalla: ${selected.title}, ${lcdState.toLowerCase()}`}>
          <span className="lcd-line">
            <span>{String(selectedIndex + 1).padStart(2, '0')}</span>
            {isLoaded && !blank && <Icon name={playing ? 'play' : 'pause'} size={13} />}
            <span className="lcd-title">{selected.title.toUpperCase()}</span>
          </span>
          <span className="lcd-line lcd-sub"><span>{lcdState}</span><span>{blank ? '--:--' : `${formatTime(current)} / ${formatTime(duration)}`}</span></span>
        </div>} />
      </section>

      <section className="rec-list" aria-labelledby="list-title">
        <h2 id="list-title">Sigue en la tanda</h2>
        {user ? <p className="feedback-help">Tus valoraciones afinan las próximas tandas de este mood. Puedes cambiarlas o quitarlas sin interrumpir la música.</p> : <p className="feedback-help"><Link to="/registro">Crea una cuenta</Link> para guardar likes y dislikes por mood.</p>}
        {feedback.loading && <p role="status">Consultando tus valoraciones…</p>}
        {feedback.error && <p role="alert">{feedback.error} <button type="button" onClick={feedback.retry} disabled={Object.values(feedback.pending).some(Boolean)}>Consultar valoraciones de nuevo</button></p>}
        <p className="feedback-message" role="status">{feedback.message}</p>
        <ol ref={list} data-keyboard-group="linear" aria-label="Canciones de la tanda">
          {tracks.map((track, index) => {
            const isSelected = track.id === selected?.id;
            const noPreview = isBlankTrack(track);
            return <li key={track.id} data-track-id={track.id}>
              <button type="button" className={`track-row${isSelected ? ' is-selected' : ''}`} aria-current={isSelected ? 'true' : undefined} onClick={() => pick(track)}
                aria-label={`${track.title}, de ${track.artist}. ${track.recommendationReason || ''}${noPreview ? ' Sin preview.' : ''}`}>
                <Disc track={track} size={44} />
                <span className="track-text">
                  <span className="track-title">{track.title}</span>
                  <span className="track-meta">{track.artist} · {reasonTag(track.recommendationReason)}</span>
                </span>
                <span className={`track-end lcd-text${noPreview ? ' is-warn' : ''}`}>{noPreview ? 'sin preview' : track.previewStatus === 'loading' ? '…' : formatDuration(track.durationMs) || String(index + 1).padStart(2, '0')}</span>
              </button>
              {user && <SongFeedback track={track} feedback={feedback} />}
            </li>;
          })}
        </ol>
        {batch.previewsPending && <p className="list-note">Buscando previews; ya puedes elegir. <button type="button" disabled={resource.loading} onClick={resource.refreshAudio}>Actualizar audio</button></p>}
        {!batch.previewsPending && tracks.some(track => track.previewStatus === 'temporary_error') && <p className="list-note">El proveedor de audio no respondió. <button type="button" disabled={resource.loading} onClick={resource.refreshAudio}>Reintentar audio</button></p>}
      </section>

      {selected && <section className="transport" aria-label="Controles de reproducción">
        {elsewhere && <div className="transport-elsewhere">
          <PlaybackDisc track={player.track} size={32} playing={player.status === 'playing'} />
          <p><span className="visually-hidden">Ahora suena, de otra lista: </span><strong>{player.track.title}</strong> · {player.track.artist}{player.source?.label ? <small> — {player.source.label}</small> : null}</p>
          <button type="button" className="icon" onClick={player.toggle} aria-label={elsewherePlaying ? 'Pausar lo que suena' : 'Continuar lo que sonaba'}><Icon name={elsewherePlaying ? 'pause' : 'play'} size={18} /></button>
          {player.source?.path && <Link to={player.source.path}>Volver</Link>}
        </div>}
        <div className="transport-now">
          <PlaybackDisc track={selected} size={60} playing={playing} />
          <div className="transport-text">
            <p className="transport-title">{selected.title}</p>
            <p className="transport-artist">{selected.artist}</p>
            {selected.recommendationReason && <p className="transport-reason">{selected.recommendationReason}</p>}
            {!blank && <ActionLink className="transport-link-mobile" href={selected.externalUrl} icon="external">{selected.provider === 'itunes' ? 'iTunes' : selected.provider === 'lastfm' ? 'Last.fm' : 'Deezer'}</ActionLink>}
          </div>
        </div>
        <div className="transport-buttons" data-keyboard-group="linear">
          <button type="button" className="icon" onClick={() => move(-1)} disabled={selectedIndex <= 0} aria-label="Canción anterior"><Icon name="previous" /></button>
          <button type="button" className="icon primary play" onClick={togglePlay} disabled={blank || !player.playable(selected)} aria-label={blank ? 'Sin preview' : playing ? 'Pausar' : 'Reproducir'}><Icon name={playing ? 'pause' : 'play'} size={24} /></button>
          <button type="button" className="icon" onClick={() => move(1)} disabled={selectedIndex >= tracks.length - 1} aria-label="Canción siguiente"><Icon name="next" /></button>
        </div>
        <div className="transport-progress lcd-text">
          {blank
            ? <div className="no-preview"><span>Sin preview de 30 s.</span><ActionLink href={selected.externalUrl} icon="external">Escuchar en {selected.provider === 'itunes' ? 'iTunes' : selected.provider === 'deezer' ? 'Deezer' : 'Last.fm'}</ActionLink></div>
            : <>
              <span>{formatTime(current)}</span>
              <input type="range" min="0" max={duration} step="0.5" value={Math.min(current, duration)} disabled={!isLoaded} style={{ '--fill': `${Math.min(100, (current / duration) * 100)}%` }} onChange={event => player.seek(Number(event.target.value))} aria-label="Posición en la canción" aria-valuetext={`${formatTime(current)} de ${formatTime(duration)}`} />
              <span>{formatTime(duration)}</span>
            </>}
        </div>
        <div className="transport-extra">
          <label className="volume"><Icon name="volume" /><span className="visually-hidden">Volumen</span><input type="range" min="0" max="1" step="0.05" value={player.volume} style={{ '--fill': `${player.volume * 100}%` }} onChange={event => player.setVolume(Number(event.target.value))} /></label>
          {!blank && <ActionLink href={selected.externalUrl} icon="external">{selected.provider === 'itunes' ? 'iTunes' : selected.provider === 'deezer' ? 'Deezer' : 'Last.fm'}</ActionLink>}
        </div>
        {isLoaded && player.error && <p className="transport-error" role="alert">{player.error}</p>}
      </section>}
    </div>}

    <nav className="rec-foot" aria-label="Seguir explorando"><ActionLink to="/moods" icon="moods">Cambiar de mood</ActionLink><ActionLink to="/explorar" icon="search">Buscar música</ActionLink></nav>
  </div>;
}
