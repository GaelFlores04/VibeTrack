import { Link, useParams } from 'react-router-dom';
import TrackList from '../../shared/components/TrackList';
import { useAuth } from '../auth/AuthProvider';
import { useRecommendations } from './useRecommendations';
export default function RecommendationsPage() {
  const { mood } = useParams();
  const { user, loading, version } = useAuth();
  if (loading) return <p role="status">Preparando tu selección…</p>;
  return <MoodRecommendations key={`${mood}:${version}`} mood={mood} user={user} />;
}
function MoodRecommendations({ mood, user }) {
  const resource = useRecommendations(mood);
  const personalized = resource.batch ? resource.batch.mode === 'personalized' : Boolean(user?.preferences);
  return <><h1>Canciones para tu mood: {mood}</h1>
    <p>{personalized ? 'Sobre todo tus artistas, más similares y tus géneros, y algún descubrimiento que encaje con este mood.' : 'Canciones conocidas para acompañar este mood.'} <Link to={user ? '/preferencias' : '/registro'}>{user ? 'Cambiar preferencias' : 'Personalizar con una cuenta'}</Link></p>
    {resource.loading && <p role="status">{resource.batch ? 'Actualizando la selección. Puedes seguir escuchando esta tanda.' : 'Preparando 7 recomendaciones…'}</p>}
    {resource.batch && <><p>{resource.batch.status === 'ready' ? `Tanda ${resource.batch.page} · 7 recomendaciones` : `${resource.batch.tracks.length} de 7 recomendaciones encontradas`} · {resource.batch.tracks.filter(track => track.previewUrl).length} con preview</p><TrackList tracks={resource.batch.tracks} /></>}
    {resource.batch?.previewsPending && <p role="status">Buscando previews; las recomendaciones ya están disponibles. <button disabled={resource.loading} onClick={resource.refreshAudio}>Actualizar audio</button></p>}
    {!resource.batch?.previewsPending && resource.batch?.tracks.some(track => track.previewStatus === 'temporary_error') && <p role="status">El proveedor de audio no respondió o alcanzó su límite. Puedes reintentar después de un minuto. <button disabled={resource.loading} onClick={resource.refreshAudio}>Reintentar audio</button></p>}
    {resource.message && <p role="status">{resource.message}</p>}
    {resource.error && <p role="alert">{resource.error}</p>}
    <button disabled={resource.loading || resource.exhausted} onClick={resource.next}>{resource.loading ? 'Preparando…' : resource.message || resource.error ? 'Reintentar tanda' : resource.batch ? 'Otras 7 canciones' : 'Preparar selección'}</button>
    <p><Link to="/moods">Cambiar de mood</Link> · <Link to="/explorar">Buscar música</Link></p>
  </>;
}
