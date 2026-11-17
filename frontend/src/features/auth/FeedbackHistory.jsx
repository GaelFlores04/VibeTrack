import { useId, useState } from 'react';
import { useResource } from '../../shared/hooks/useResource';
import { mutate } from '../../shared/services/api';
import ResourceState from '../../shared/components/ResourceState';

const moods = { feliz: 'Feliz', relajado: 'Relajado', motivado: 'Motivado', triste: 'Triste', romantico: 'Romántico', cansado: 'Cansado' };
export default function FeedbackHistory() {
  const [mood, setMood] = useState('feliz');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(20);
  const [removed, setRemoved] = useState(new Set());
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const id = useId();
  const resource = useResource(`/music/feedback/${mood}/history`);
  const term = query.trim().toLocaleLowerCase();
  const entries = (resource.data || []).filter(entry => !removed.has(`${mood}:${entry.key}`) && `${entry.title} ${entry.artist}`.toLocaleLowerCase().includes(term));
  async function remove(entry, event) {
    const selectedMood = mood;
    const next = event.currentTarget.closest('li').nextElementSibling?.querySelector('button') || event.currentTarget.closest('li').previousElementSibling?.querySelector('button');
    const keyboard = event.detail === 0;
    setPending(entry.key); setError(''); setMessage('');
    try {
      await mutate(`/music/feedback/${selectedMood}/${entry.key}`, 'DELETE');
      setRemoved(value => new Set([...value, `${selectedMood}:${entry.key}`]));
      setMessage(`Valoración de ${entry.title} quitada. Se aplicará a las próximas tandas.`);
      if (keyboard) requestAnimationFrame(() => (next?.isConnected ? next : document.getElementById(`${id}-search`))?.focus());
    } catch (err) { setError(err.message); } finally { setPending(''); }
  }
  return <section className="feedback-history" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Cómo encajan las canciones con cada mood</h2>
    <p>Estas valoraciones indican si la canción encaja con ese momento. «No encaja» la evita sólo en ese mood; no significa que no te guste el artista. Puedes quitar cualquier valoración anterior.</p>
    <div className="history-filters">
      <label htmlFor={`${id}-mood`}>Mood<select id={`${id}-mood`} disabled={!!pending} value={mood} onChange={event => { setMood(event.target.value); setLimit(20); setError(''); setMessage(''); }}>{Object.entries(moods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor={`${id}-search`}>Buscar una canción o artista<input id={`${id}-search`} type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(20); }} /></label>
    </div>
    {error && <p role="alert">{error} Vuelve a pulsar «Quitar valoración» para reintentar.</p>}
    <p role="status">{message}</p>
    <ResourceState resource={resource}>
      {!entries.length && <p>{term ? 'No hay valoraciones que coincidan con tu búsqueda.' : 'Todavía no tienes valoraciones en este mood. Puedes añadirlas desde sus tandas.'}</p>}
      <ul className="feedback-history-list" data-keyboard-group="linear">{entries.slice(0, limit).map(entry => <li key={entry.key}><div><strong>{entry.title}</strong><span>{entry.artist} · {entry.rating === 'like' ? 'Encaja con el mood' : 'No encaja con el mood'}</span></div><button type="button" disabled={!!pending} onClick={event => remove(entry, event)} aria-label={`Quitar valoración de ${entry.title}`}>{pending === entry.key ? 'Quitando…' : 'Quitar valoración'}</button></li>)}</ul>
      {entries.length > limit && <button type="button" onClick={() => setLimit(value => value + 20)}>Mostrar más valoraciones</button>}
    </ResourceState>
  </section>;
}
