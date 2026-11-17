import { useCallback, useEffect, useRef, useState } from 'react';
import { api, mutate } from '../../shared/services/api';

// Reproducción completa con Spotify Premium (Web Playback SDK): el navegador se convierte en un
// dispositivo "VibeTrack". El token corto lo da el backend; el de renovación nunca llega aquí.
const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
let sdkPromise;
function loadSdk() {
  if (window.Spotify) return Promise.resolve();
  sdkPromise ||= new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = resolve;
    const script = document.createElement('script');
    script.src = SDK_URL; script.async = true;
    script.onerror = () => { sdkPromise = undefined; reject(new Error('No se pudo cargar el reproductor de Spotify.')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

// status: off (sin conectar) · loading · ready · error. onState recibe { position, duration, paused, uri }.
export function useSpotify(signedIn, onState) {
  const [connection, setConnection] = useState(null);
  const [status, setStatus] = useState('off');
  const [message, setMessage] = useState('');
  const player = useRef(null);
  const device = useRef(null);
  const uris = useRef(new Map());
  const listener = useRef(onState);
  listener.current = onState;

  const refresh = useCallback(() => {
    if (!signedIn) { setConnection(null); return Promise.resolve(null); }
    return api('/spotify/status').then(value => { setConnection(value); return value; }).catch(() => { setConnection(null); return null; });
  }, [signedIn]);
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!connection?.connected) { setStatus('off'); return undefined; }
    let cancelled = false;
    setStatus('loading'); setMessage('');
    loadSdk().then(() => {
      if (cancelled) return;
      const instance = new window.Spotify.Player({
        name: 'VibeTrack', volume: 1,
        getOAuthToken: callback => { api('/spotify/token').then(value => callback(value.accessToken)).catch(() => { setStatus('error'); setMessage('La conexión con Spotify caducó. Vuelve a conectarla en tu cuenta.'); }); },
      });
      instance.addListener('ready', ({ device_id: id }) => { device.current = id; setStatus('ready'); });
      instance.addListener('not_ready', () => { device.current = null; setStatus('loading'); });
      instance.addListener('initialization_error', () => { setStatus('error'); setMessage('Este navegador no puede reproducir Spotify. Seguimos con los previews de 30 s.'); });
      instance.addListener('authentication_error', () => { setStatus('error'); setMessage('Spotify no aceptó la sesión. Vuelve a conectarla en tu cuenta.'); });
      instance.addListener('account_error', () => { setStatus('error'); setMessage('La reproducción completa necesita Spotify Premium. Seguimos con los previews de 30 s.'); });
      instance.addListener('player_state_changed', state => {
        if (!state) return;
        listener.current?.({ position: state.position / 1000, duration: state.duration / 1000, paused: state.paused, uri: state.track_window?.current_track?.uri });
      });
      instance.connect();
      player.current = instance;
    }).catch(err => { if (!cancelled) { setStatus('error'); setMessage(err.message); } });
    return () => { cancelled = true; player.current?.disconnect(); player.current = null; device.current = null; };
  }, [connection?.connected]);

  // Posición en vivo mientras suena (el SDK sólo avisa en los cambios de estado).
  const poll = useCallback(async () => {
    const state = await player.current?.getCurrentState().catch(() => null);
    if (state) listener.current?.({ position: state.position / 1000, duration: state.duration / 1000, paused: state.paused, uri: state.track_window?.current_track?.uri });
  }, []);

  // URI de Spotify por canción (null si no está en Spotify). Se piden de 10 en 10.
  const match = useCallback(async tracks => {
    const missing = tracks.filter(track => track.id?.startsWith('deezer:') && !uris.current.has(track.id));
    for (let i = 0; i < missing.length; i += 10) {
      const chunk = missing.slice(i, i + 10).map(({ id, title, artist }) => ({ id, title, artist }));
      const found = await mutate('/spotify/match', 'POST', { tracks: chunk });
      for (const [id, uri] of Object.entries(found || {})) uris.current.set(id, uri);
    }
    return Object.fromEntries(tracks.map(track => [track.id, uris.current.get(track.id) || null]));
  }, []);

  const play = useCallback(async uri => {
    if (!device.current) throw new Error('Spotify aún no está listo.');
    // Debe llamarse dentro del gesto del usuario para que el navegador permita el audio (móviles).
    await player.current?.activateElement?.();
    const { accessToken } = await api('/spotify/token');
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device.current)}`, {
      method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ uris: [uri] }),
    });
    if (!response.ok) throw new Error(response.status === 403 ? 'La reproducción completa necesita Spotify Premium.' : 'Spotify no pudo reproducir esta canción.');
  }, []);

  return {
    connection, status, message, ready: status === 'ready', refresh, match, play, poll,
    pause: () => player.current?.pause(), resume: () => player.current?.resume(),
    seek: seconds => player.current?.seek(Math.round(seconds * 1000)),
    setVolume: value => player.current?.setVolume(value),
    uriFor: id => uris.current.get(id) || null,
  };
}
