import { useEffect, useRef, useState } from 'react';
import { api, mutate } from '../../shared/services/api';

export function useSongFeedback(mood, userId) {
  const [ratings, setRatings] = useState({});
  const [tasteRules, setTasteRules] = useState([]);
  const [tasteReady, setTasteReady] = useState(false);
  const [tasteError, setTasteError] = useState('');
  const [pending, setPending] = useState({});
  const pendingRef = useRef(new Set());
  const [loading, setLoading] = useState(Boolean(userId));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const scope = `${userId}:${mood}`;
  const current = useRef(scope); current.current = scope;
  useEffect(() => {
    const controller = new AbortController();
    current.current = scope; setReady(false);
    setTasteRules([]); setTasteReady(false); setTasteError('');
    setRatings({}); setPending({}); pendingRef.current.clear(); setError(''); setMessage('');
    setLoading(Boolean(userId));
    if (userId) api(`/music/feedback/${encodeURIComponent(mood)}`, controller.signal)
      .then(value => { if (!controller.signal.aborted) { setRatings(value); setLoading(false); setReady(true); } })
      .catch(err => { if (!controller.signal.aborted) { setError(err.message); setLoading(false); } });
    if (userId) api('/music/taste-rules', controller.signal)
      .then(value => { if (!controller.signal.aborted) { setTasteRules(Array.isArray(value) ? value : []); setTasteReady(true); } })
      .catch(err => { if (!controller.signal.aborted) setTasteError(err.message); });
    return () => { controller.abort(); current.current = null; };
  }, [scope, attempt]);
  async function rate(track, choice) {
    const key = track.feedbackKey;
    if (!userId || !key || !ready || pendingRef.current.has(key)) return;
    const previous = ratings[key] || null, rating = previous === choice ? null : choice;
    pendingRef.current.add(key); setPending(value => ({ ...value, [key]: true }));
    setRatings(value => ({ ...value, [key]: rating })); setError(''); setMessage('');
    try {
      await mutate('/music/feedback', 'POST', { trackId: track.id, mood, rating });
      if (current.current === scope) setMessage(rating === 'like' ? `${track.title} encaja con este mood. Afinaremos las próximas tandas.` : rating === 'dislike' ? `Evitaremos ${track.title} en las próximas tandas de este mood.` : `Valoración de ${track.title} quitada.`);
    } catch (err) {
      if (current.current === scope) { setRatings(value => ({ ...value, [key]: previous })); setError(err.message); }
    } finally {
      if (current.current === scope) { pendingRef.current.delete(key); setPending(value => ({ ...value, [key]: false })); }
    }
  }
  async function rateTaste(track, target, action) {
    const name = target === 'song' ? track.title : track.artist;
    const key = `taste:${target}:${name}:${target === 'song' ? track.artist : ''}`;
    if (!userId || !tasteReady || pendingRef.current.has(key)) return;
    const existing = tasteRules.find(rule => rule.target === target && rule.name === name && (target !== 'song' || rule.artist === track.artist));
    pendingRef.current.add(key); setPending(value => ({ ...value, [key]: true })); setTasteError(''); setMessage('');
    try {
      if (existing?.action === action) {
        await mutate(`/music/taste-rules/${existing.key}`, 'DELETE');
        if (current.current === scope) setTasteRules(value => value.filter(rule => rule.key !== existing.key));
      } else {
        const rule = await mutate('/music/taste-rules', 'POST', { target, name, ...(target === 'song' ? { artist: track.artist } : {}), action });
        if (current.current === scope) setTasteRules(value => [...value.filter(item => item.key !== rule.key), rule]);
      }
      if (current.current === scope) setMessage(`Gusto de ${name} actualizado para las próximas tandas de todos los moods.`);
    } catch (err) { if (current.current === scope) setTasteError(err.message); }
    finally { if (current.current === scope) { pendingRef.current.delete(key); setPending(value => ({ ...value, [key]: false })); } }
  }
  return { ratings, pending, loading, ready, error, message, rate, tasteRules, tasteReady, tasteError, rateTaste, retry: () => setAttempt(value => value + 1) };
}
