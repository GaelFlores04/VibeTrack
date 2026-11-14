import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthProvider';
export default function AccountPage() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function exit() { setBusy(true); setError(''); try { await logout(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  return <><h1>Tu cuenta</h1><p>{user.name} · {user.email}</p><p>{user.preferences ? 'Tus recomendaciones tienen en cuenta tus preferencias dentro del mood que elijas.' : 'Todavía no hay preferencias. Escucharás una selección inicial de canciones conocidas por mood.'}</p>
    <p><Link to="/preferencias">Configurar preferencias</Link> · <Link to="/moods">Elegir un mood</Link></p>
    {error && <p role="alert">{error}</p>}<button onClick={exit} disabled={busy}>{busy ? 'Cerrando…' : 'Cerrar sesión'}</button></>;
}
