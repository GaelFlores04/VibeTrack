import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import Autocomplete from '../../shared/components/Autocomplete';
import GenrePicker from './GenrePicker';
import FeedbackHistory from './FeedbackHistory';
import TasteSourceSection from './TasteSourceSection';
import PreferenceLevel from './PreferenceLevel';
import TasteRules from './TasteRules';
import { usePlayer } from '../player/PlayerProvider';
export default function PreferencesPage() {
  const { user, savePreferences, clearPreferences } = useAuth();
  // Con "Sólo Spotify" el cuestionario se conserva pero no se usa al recomendar.
  const spotifyOnly = usePlayer().spotify.connection?.tasteSource === 'spotify';
  const [selected, setSelected] = useState(user.preferences?.genres || []);
  const [level, setLevel] = useState(user.preferences?.preferenceLevel ?? 3);
  const [artists, setArtists] = useState(() => [...new Set((user.preferences?.artists || []).map(name => name.replace(/\s+[-–—]\s*topic\s*$/iu, '').trim()).filter(Boolean))]);
  const [artistQuery, setArtistQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const artistField = useRef(null);
  function removeArtist(name, event) {
    const tag = event.currentTarget.closest('li');
    const next = tag.nextElementSibling?.querySelector('button') || tag.previousElementSibling?.querySelector('button');
    setArtists(items => items.filter(item => item !== name));
    if (event.detail === 0) requestAnimationFrame(() => {
      (next?.isConnected ? next : artistField.current?.querySelector('input'))?.focus();
    });
  }
  async function save(event) {
    event.preventDefault(); setError(''); setMessage('');
    const names = artists;
    setBusy(true);
    try { await savePreferences({ genres: selected, artists: names, preferenceLevel: level }); setMessage('Preferencias guardadas. Se aplicarán a tu próxima selección de mood.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError(''); setMessage('');
    try { await clearPreferences(); setSelected([]); setArtists([]); setLevel(3); setArtistQuery(''); setMessage('Cuestionario eliminado y nivel equilibrado restaurado. Tus ajustes y valoraciones se conservan.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><h1>Tus preferencias musicales</h1><p>Decide cuánto quieres descubrir y qué te gustaría escuchar más. Tus ajustes se aplican a las próximas tandas, sin interrumpir la música.</p>
    <TasteSourceSection />
    <form className="account-form preferences-form" onSubmit={save}>
      <PreferenceLevel value={level} onChange={setLevel} disabled={busy} />
      {spotifyOnly && <p className="form-note" role="note">Tus recomendaciones usan sólo tus gustos de Spotify: estos géneros y artistas quedan guardados, pero no se aplican mientras tengas elegida la fuente Spotify.</p>}
      <fieldset className="questionnaire" disabled={spotifyOnly}>
      <GenrePicker selected={selected} onChange={setSelected} disabled={busy || spotifyOnly} />
      <div ref={artistField}><Autocomplete selectionOnly label="Busca y selecciona hasta cinco artistas" value={artistQuery} onChange={setArtistQuery} endpoint="/music/artists" disabled={busy || spotifyOnly || artists.length >= 5} excluded={artists} placeholder="Empieza a escribir un artista…" onSelect={item => { setArtists(items => items.length < 5 && !items.some(name => name.toLocaleLowerCase() === item.name.toLocaleLowerCase()) ? [...items, item.name] : items); setArtistQuery(''); }} />
        <ul className="artist-tags" aria-label="Artistas seleccionados" data-keyboard-group="linear">{artists.map(name => <li key={name}><span>{name}</span><button type="button" disabled={busy} onClick={event => removeArtist(name, event)} aria-label={`Quitar a ${name}`}>×</button></li>)}</ul>
        <p>{artists.length}/5 artistas seleccionados. Selecciona un resultado para añadirlo.</p>
      </div>
      </fieldset>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="actions"><button disabled={busy}>Guardar preferencias</button><button type="button" disabled={busy} onClick={reset}>Eliminar preferencias</button></div>
    </form><p><Link to="/moods">{user.preferences ? 'Elegir un mood' : 'Omitir y escuchar canciones conocidas'}</Link></p>
    <TasteRules />
    <FeedbackHistory />
  </>;
}
