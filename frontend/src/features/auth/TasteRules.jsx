import { useId, useState } from 'react';
import { useResource } from '../../shared/hooks/useResource';
import { mutate } from '../../shared/services/api';
import Autocomplete from '../../shared/components/Autocomplete';
import ResourceState from '../../shared/components/ResourceState';

export const TASTE_ACTIONS = { more: 'Más de esto', less: 'Menos de esto', exclude: 'No mostrar' };
const targets = { song: 'Canción', artist: 'Artista', genre: 'Género' };

export default function TasteRules() {
  const resource = useResource('/music/taste-rules');
  const genres = useResource('/music/genres');
  const [changes, setChanges] = useState({});
  const [target, setTarget] = useState('artist');
  const [choice, setChoice] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [action, setAction] = useState('more');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(20);
  const id = useId();
  const entries = Object.values({ ...Object.fromEntries((resource.data || []).map(rule => [rule.key, rule])), ...changes }).filter(Boolean);
  const filtered = entries.filter(rule => `${rule.name} ${rule.artist || ''}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  async function save(input, key = 'new') {
    setBusy(key); setError(''); setMessage('');
    try {
      const rule = await mutate('/music/taste-rules', 'POST', { target: input.target, name: input.name, artist: input.artist, action: input.action });
      setChanges(value => ({ ...value, [rule.key]: rule }));
      setMessage(`${TASTE_ACTIONS[rule.action]}: ${rule.name}. Se aplicará a las próximas tandas.`);
      if (key === 'new') { setChoice(null); setQuery(''); }
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  async function remove(rule, event) {
    const next = event.currentTarget.closest('li')?.nextElementSibling?.querySelector('select');
    const keyboard = event.detail === 0;
    setBusy(rule.key); setError(''); setMessage('');
    try {
      await mutate(`/music/taste-rules/${rule.key}`, 'DELETE');
      setChanges(value => ({ ...value, [rule.key]: null })); setMessage(`Ajuste de ${rule.name} quitado.`);
      if (keyboard) requestAnimationFrame(() => (next?.isConnected ? next : document.getElementById(`${id}-filter`))?.focus());
    } catch (err) { setError(err.message); } finally { setBusy(''); }
  }
  return <section className="taste-rules" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Afina tus gustos</h2>
    <p>Estos ajustes se aplican a todos los moods. Una canción tiene prioridad sobre su artista, y un artista sobre su género: puedes pedir más de una canción aunque excluyas el resto del artista.</p>
    <form className="taste-rule-form" onSubmit={event => { event.preventDefault(); if (choice) void save({ target, ...choice, action }); }}>
      <label>Qué quieres ajustar<select disabled={!!busy} value={target} onChange={event => { setTarget(event.target.value); setChoice(null); setQuery(''); }}>{Object.entries(targets).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {target === 'genre' ? <label>Género<select disabled={!!busy || !genres.data} value={choice?.name || ''} onChange={event => setChoice(event.target.value ? { name: event.target.value } : null)}>
        <option value="">Selecciona un género</option>{(genres.data || []).map(group => <optgroup key={group.id} label={group.label}><option value={group.id}>{group.label} · todos</option>{group.children.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}
      </select>{genres.error && <span role="alert">No se cargaron los géneros. Vuelve a cargar Preferencias.</span>}</label>
        : <Autocomplete label={target === 'song' ? 'Busca una canción' : 'Busca un artista'} value={query} onChange={value => { setQuery(value); setChoice(null); }} endpoint={target === 'song' ? '/music/suggestions' : '/music/artists'} disabled={!!busy} kindFilter={target === 'song' ? 'track' : 'artist'} onSelect={item => { setChoice({ name: item.name, ...(target === 'song' ? { artist: item.artist } : {}) }); setQuery(item.name); }} />}
      <label>Qué prefieres<select disabled={!!busy} value={action} onChange={event => setAction(event.target.value)}>{Object.entries(TASTE_ACTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button disabled={!!busy || !choice || !resource.data}>{busy === 'new' ? 'Guardando…' : 'Añadir ajuste'}</button>
    </form>
    {error && <p role="alert">{error}</p>}<p role="status">{message}</p>
    <ResourceState resource={resource}>
      <label htmlFor={`${id}-filter`}>Buscar en tus ajustes<input id={`${id}-filter`} type="search" value={filter} onChange={event => { setFilter(event.target.value); setLimit(20); }} /></label>
      {!filtered.length && <p>{filter ? 'No hay ajustes con ese nombre.' : 'Todavía no has añadido ajustes. También puedes hacerlo desde una canción recomendada.'}</p>}
      <ul className="taste-rule-list">{filtered.slice(0, limit).map(rule => <li key={rule.key}>
        <div><strong>{rule.name}</strong><span>{targets[rule.target]}{rule.artist ? ` · ${rule.artist}` : ''}</span></div>
        <label><span className="sr-only">Preferencia para {rule.name}</span><select value={rule.action} disabled={!!busy} onChange={event => save({ ...rule, action: event.target.value }, rule.key)}>{Object.entries(TASTE_ACTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" disabled={!!busy} onClick={event => remove(rule, event)} aria-label={`Quitar ajuste de ${rule.name}`}>Quitar</button>
      </li>)}</ul>
      {filtered.length > limit && <button type="button" onClick={() => setLimit(value => value + 20)}>Mostrar más ajustes</button>}
    </ResourceState>
  </section>;
}
