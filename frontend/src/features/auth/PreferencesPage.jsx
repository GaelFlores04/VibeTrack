import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import Autocomplete from '../../shared/components/Autocomplete';
const genres = { pop: 'Pop', rock: 'Rock', indie: 'Indie', electronic: 'Electrónica', 'hip-hop': 'Hip-hop', 'r&b': 'R&B / Soul', latin: 'Latina', jazz: 'Jazz', classical: 'Clásica / Piano', folk: 'Folk', metal: 'Metal', ambient: 'Ambient' };
export default function PreferencesPage() {
  const { user, savePreferences, clearPreferences } = useAuth();
  const [selected, setSelected] = useState(user.preferences?.genres || []);
  const [artists, setArtists] = useState(() => [...new Set((user.preferences?.artists || []).map(name => name.replace(/\s+[-–—]\s*topic\s*$/iu, '').trim()).filter(Boolean))]);
  const [artistQuery, setArtistQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save(event) {
    event.preventDefault(); setError(''); setMessage('');
    const names = artists;
    setBusy(true);
    try { await savePreferences({ genres: selected, artists: names }); setMessage(selected.length || names.length ? 'Preferencias guardadas. Se aplicarán a tu próxima selección de mood.' : 'Sin preferencias: usaremos la selección de canciones conocidas.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setError(''); setMessage('');
    try { await clearPreferences(); setSelected([]); setArtists([]); setArtistQuery(''); setMessage('Preferencias eliminadas. Volvemos a la selección de canciones conocidas.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <><h1>Tus preferencias musicales</h1><p>Cuestionario opcional. Tus gustos ordenan las canciones que encajen con el mood; no cambian su categoría.</p>
    <form className="account-form" onSubmit={save}>
      <fieldset disabled={busy}><legend>¿Qué géneros te gustan? Elige hasta seis.</legend>
        {Object.entries(genres).map(([value, label]) => <label className="check-option" key={value}><input type="checkbox" checked={selected.includes(value)} disabled={!selected.includes(value) && selected.length >= 6} onChange={event => setSelected(items => event.target.checked ? [...items, value] : items.filter(item => item !== value))} />{label}</label>)}
      </fieldset>
      <div><Autocomplete selectionOnly label="Busca y selecciona hasta cinco artistas" value={artistQuery} onChange={setArtistQuery} endpoint="/music/artists" disabled={busy || artists.length >= 5} excluded={artists} placeholder="Empieza a escribir un artista…" onSelect={item => { setArtists(items => items.length < 5 && !items.some(name => name.toLocaleLowerCase() === item.name.toLocaleLowerCase()) ? [...items, item.name] : items); setArtistQuery(''); }} />
        <ul className="artist-tags" aria-label="Artistas seleccionados">{artists.map(name => <li key={name}><span>{name}</span><button type="button" disabled={busy} onClick={() => setArtists(items => items.filter(item => item !== name))} aria-label={`Quitar a ${name}`}>×</button></li>)}</ul>
        <p>{artists.length}/5 artistas seleccionados. Selecciona un resultado para añadirlo.</p>
      </div>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="actions"><button disabled={busy}>Guardar preferencias</button><button type="button" disabled={busy} onClick={reset}>Eliminar preferencias</button></div>
    </form><p><Link to="/moods">{user.preferences ? 'Elegir un mood' : 'Omitir y escuchar canciones conocidas'}</Link></p>
  </>;
}
