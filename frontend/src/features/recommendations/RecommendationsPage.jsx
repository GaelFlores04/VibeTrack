import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { formatTime, usePlayer } from '../player/PlayerProvider';
import PlayerStage from '../player/PlayerStage';
import { formatDuration, isBlankTrack, reasonTag } from '../player/trackState';
import Disc from '../../shared/components/Disc';
import PlaybackDisc from '../../shared/components/PlaybackDisc';
import { moodPresentation } from '../moods/moodPresentation';
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
  const source = useMemo(() => page ? { key: `mood:${mood}:${page}`, label: `${moodName} · toma ${page}`, path: `/recomendaciones/${mood}${page > 1 ? `?tanda=${page}` : ''}` } : null, [mood, moodName, page]);
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

  // Estado de cada pista en la hoja: sólo se marca "escuchada" lo que de verdad sonó en esta toma.
  const [heard, setHeard] = useState(() => new Set());
  useEffect(() => {
    if (owns && player.status === 'playing' && player.track) setHeard(current => current.has(player.track.id) ? current : new Set(current).add(player.track.id));
  }, [owns, player.status, player.track?.id]);
  useEffect(() => { setHeard(new Set()); }, [page]);
  const stateOf = track => {
    if (isBlankTrack(track)) return { label: 'Sin preview', tone: 'warn' };
    if (track.id === selected?.id) return playing ? { label: 'Sonando', tone: 'live' } : { label: 'En el plato', tone: 'set' };
    if (heard.has(track.id)) return { label: 'Escuchada', tone: 'done' };
    return { label: 'En cola', tone: 'queue' };
  };

  const plateState = !selected ? 'Plato vacío' : blank ? 'Sin preview' : !isLoaded ? (full ? 'Completa en Spotify' : 'Lista') : player.status === 'loading' ? 'Bajando la aguja' : playing ? 'Sonando' : 'En pausa';
  const current = isLoaded ? player.time.current : 0;
  const duration = isLoaded && Number.isFinite(player.time.duration) && player.time.duration ? player.time.duration : full ? (selected.durationMs || 30000) / 1000 : 30;
  const stageLabel = selected ? `Tocadiscos con el vinilo de ${selected.title}, de ${selected.artist}. ${blank ? 'Sin preview.' : playing ? 'Sonando.' : 'Detenido.'} En la caja quedan ${Math.max(0, tracks.length - 1)} discos.` : 'Tocadiscos vacío.';
  const providerName = selected?.provider === 'itunes' ? 'iTunes' : selected?.provider === 'lastfm' ? 'Last.fm' : 'Deezer';

  return <div className="rec-page session" style={{ '--sticker': moodPresentation(mood).color }}>
    <header className="session-head">
      <div className="session-title">
        <h1><span className="title-sticker" aria-hidden="true" />{moodName}</h1>
        <p className="lede">{personalized ? 'Sobre todo tus artistas, más similares y tus géneros, y algún descubrimiento que encaje con este mood.' : 'Canciones conocidas para acompañar este mood.'} <Link to={user ? '/preferencias' : '/registro'}>{user ? 'Ajustar en la consola' : 'Personalizar con una cuenta'}</Link></p>
      </div>
      <nav className="take-nav" aria-label="Tomas de la sesión">
        <button type="button" disabled={resource.loading || page <= 1} onClick={resource.previous}><Icon name="previous" size={18} /><span className="long">Toma anterior</span><span className="short">Anterior</span></button>
        {page > 0 && <span className="take-count" aria-live="polite">Toma <strong>{page}</strong></span>}
        <button type="button" className="primary" disabled={resource.loading || (resource.exhausted && !resource.hasNewer)} onClick={resource.next}>
          {resource.loading ? 'Preparando…' : resource.hasNewer ? 'Siguiente toma' : resource.message || resource.error ? 'Reintentar toma' : batch ? <><span className="long">Otra toma · 7 nuevas</span><span className="short">Otra toma</span></> : 'Preparar sesión'}
          {!resource.loading && <Icon name="next" size={18} />}
        </button>
      </nav>
    </header>

    {resource.loading && <p role="status" className="rec-status">{batch ? 'Preparando la siguiente toma. Puedes seguir escuchando esta.' : 'Preparando la sesión: buscando 7 canciones que suenen a este mood…'}</p>}
    {resource.notice && <p role="status" className="rec-status rec-notice">{resource.notice}</p>}
    {resource.message && <p role="status" className="rec-status">{resource.message}</p>}
    {resource.error && <p role="alert" className="rec-status">{resource.error}</p>}

    {batch && <div className="session-layout">
      <section className="rec-stage" aria-labelledby="stage-title">
        <h2 id="stage-title" ref={heading} tabIndex="-1" className="visually-hidden">{ready ? `Toma ${batch.page}` : 'Toma parcial'}</h2>
        <p className={`stage-sign${playing ? ' is-lit' : ''}`} aria-hidden="true">EN EL AIRE</p>
        <p className="stack-count">{tracks.length} discos · 1 en el plato{batch.previewsPending ? ' · buscando previews' : ''}</p>
        <PlayerStage tracks={tracks} selected={selected} playing={playing} reduced={reduced} onPick={pick} label={stageLabel}
          lcd={selected && <div className="plate" role="status" aria-live="off" aria-label={`Placa: pista ${selectedIndex + 1}, ${selected.title}, ${plateState.toLowerCase()}`}>
            <span className="plate-line">
              <span className="plate-num">{String(selectedIndex + 1).padStart(2, '0')}</span>
              <span className="plate-title">{selected.title}</span>
            </span>
            <span className="plate-line plate-sub"><span>{plateState}</span><span>{blank ? '--:--' : `${formatTime(current)} / ${formatTime(duration)}`}</span></span>
          </div>} />
      </section>

      <section className="session-sheet" aria-labelledby="list-title">
        <div className="sheet-clip" aria-hidden="true" />
        <h2 id="list-title">Hoja de sesión</h2>
        <p className="sheet-meta"><span>{moodName}</span><span>Toma {page || 1}</span><span>{tracks.length} pistas</span></p>
        {user ? <p className="feedback-help">Marca si cada pista encaja con el mood: afina las próximas tomas, sin cortar la música.</p> : <p className="feedback-help"><Link to="/registro">Crea una cuenta</Link> para guardar si cada pista encaja con el mood.</p>}
        {feedback.loading && <p role="status">Consultando tus valoraciones…</p>}
        {feedback.error && <p role="alert">{feedback.error} <button type="button" onClick={feedback.retry} disabled={Object.values(feedback.pending).some(Boolean)}>Consultar valoraciones de nuevo</button></p>}
        <p className="feedback-message" role="status">{feedback.message}</p>
        <ol ref={list} data-keyboard-group="linear" aria-label="Pistas de la toma">
          {tracks.map((track, index) => {
            const isSelected = track.id === selected?.id;
            const noPreview = isBlankTrack(track);
            const state = stateOf(track);
            return <li key={track.id} data-track-id={track.id} className={`sheet-row tone-${state.tone}`}>
              <button type="button" className={`track-row${isSelected ? ' is-selected' : ''}`} aria-current={isSelected ? 'true' : undefined} onClick={() => pick(track)}
                aria-label={`Pista ${index + 1}: ${track.title}, de ${track.artist}. ${state.label}. ${track.recommendationReason || ''}`}>
                <span className="track-num">{String(index + 1).padStart(2, '0')}</span>
                <Disc track={track} size={40} />
                <span className="track-text">
                  <span className="track-title">{track.title}</span>
                  <span className="track-meta">{track.artist} · {reasonTag(track.recommendationReason)}</span>
                </span>
                <span className="track-end">
                  <span className="track-time">{noPreview ? '--:--' : track.previewStatus === 'loading' ? '…' : formatDuration(track.durationMs) || '0:30'}</span>
                  <span className="track-state">{state.label}</span>
                </span>
              </button>
              {user && <SongFeedback track={track} feedback={feedback} />}
            </li>;
          })}
        </ol>
        {batch.previewsPending && <p className="list-note">Buscando previews; ya puedes elegir. <button type="button" disabled={resource.loading} onClick={resource.refreshAudio}>Actualizar audio</button></p>}
        {!batch.previewsPending && tracks.some(track => track.previewStatus === 'temporary_error') && <p className="list-note">El proveedor de audio no respondió. <button type="button" disabled={resource.loading} onClick={resource.refreshAudio}>Reintentar audio</button></p>}
      </section>

      {selected && <section className="transport plinth-controls" aria-label="Controles del tocadiscos">
        {elsewhere && <div className="transport-elsewhere">
          <PlaybackDisc track={player.track} size={32} playing={player.status === 'playing'} />
          <p><span className="visually-hidden">Ahora suena, de otra sesión: </span><strong>{player.track.title}</strong> · {player.track.artist}{player.source?.label ? <small> — {player.source.label}</small> : null}</p>
          <button type="button" className="icon" onClick={player.toggle} aria-label={elsewherePlaying ? 'Pausar lo que suena' : 'Continuar lo que sonaba'}><Icon name={elsewherePlaying ? 'pause' : 'play'} size={18} /></button>
          {player.source?.path && <Link to={player.source.path}>Volver</Link>}
        </div>}
        <div className="transport-now">
          <PlaybackDisc track={selected} size={56} playing={playing} />
          <div className="transport-text">
            <p className="transport-title">{selected.title}</p>
            <p className="transport-artist">{selected.artist}</p>
            {selected.recommendationReason && <p className="transport-reason">{selected.recommendationReason}</p>}
            {!blank && <ActionLink className="transport-link-mobile" href={selected.externalUrl} icon="external">{providerName}</ActionLink>}
          </div>
        </div>
        <div className="transport-buttons" data-keyboard-group="linear">
          <button type="button" className="icon" onClick={() => move(-1)} disabled={selectedIndex <= 0} aria-label="Pista anterior"><Icon name="previous" /></button>
          <button type="button" className="icon primary play" onClick={togglePlay} disabled={blank || !player.playable(selected)} aria-label={blank ? 'Sin preview' : playing ? 'Pausar' : 'Reproducir'}><Icon name={playing ? 'pause' : 'play'} size={26} /></button>
          <button type="button" className="icon" onClick={() => move(1)} disabled={selectedIndex >= tracks.length - 1} aria-label="Pista siguiente"><Icon name="next" /></button>
        </div>
        <div className="transport-progress">
          {blank
            ? <div className="no-preview"><span>Sin preview de 30 s.</span><ActionLink href={selected.externalUrl} icon="external">Escuchar en {providerName}</ActionLink></div>
            : <>
              <span>{formatTime(current)}</span>
              <input type="range" min="0" max={duration} step="0.5" value={Math.min(current, duration)} disabled={!isLoaded} style={{ '--fill': `${Math.min(100, (current / duration) * 100)}%` }} onChange={event => player.seek(Number(event.target.value))} aria-label="Posición en la pista" aria-valuetext={`${formatTime(current)} de ${formatTime(duration)}`} />
              <span>{formatTime(duration)}</span>
            </>}
        </div>
        <div className="transport-extra">
          <label className="volume"><Icon name="volume" /><span className="visually-hidden">Volumen</span><input type="range" min="0" max="1" step="0.05" value={player.volume} style={{ '--fill': `${player.volume * 100}%` }} onChange={event => player.setVolume(Number(event.target.value))} /></label>
          {!blank && <ActionLink href={selected.externalUrl} icon="external">{providerName}</ActionLink>}
        </div>
        {isLoaded && player.error && <p className="transport-error" role="alert">{player.error}</p>}
      </section>}
    </div>}

    <nav className="rec-foot" aria-label="Seguir en el estudio"><ActionLink to="/moods" icon="moods">Otra caja del estante</ActionLink><ActionLink to="/explorar" icon="search">Ir a la cabina</ActionLink></nav>
  </div>;
}
