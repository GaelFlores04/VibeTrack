import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { api, mutate } from '../../shared/services/api';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api('/auth/refresh', controller.signal, { method: 'POST' }).then(value => { if (!controller.signal.aborted) { setUser(value); setLoading(false); setVersion(v => v + 1); } })
      .catch(err => { if (!controller.signal.aborted) { setLoading(false); setError(err.message); } });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const timer = setInterval(() => {
      mutate('/auth/refresh', 'POST').then(value => { if (!stopped) setUser(value); }).catch(() => {});
    }, 10 * 60 * 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [user?.id]);
  const accept = value => { setUser(value); setVersion(v => v + 1); setError(''); };
  async function authenticate(mode, values) { const value = await mutate(`/auth/${mode}`, 'POST', values); accept(value); return value; }
  async function logout() { await mutate('/auth/logout', 'POST'); accept(null); }
  async function updatePreferences(method, values) {
    try { const value = await mutate('/auth/preferences', method, values); accept(value); }
    catch (err) { if (err.status === 401) accept(null); throw err; }
  }
  async function savePreferences(values) { await updatePreferences('PUT', values); }
  async function clearPreferences() { await updatePreferences('DELETE'); }
  return <AuthContext.Provider value={{ user, loading, error, version, authenticate, logout, savePreferences, clearPreferences }}>
    {error && <aside role="alert" className="session-message">No se pudo comprobar tu sesión: {error} <button onClick={() => setAttempt(v => v + 1)}>Reintentar sesión</button></aside>}
    {children}
  </AuthContext.Provider>;
}
export function RequireAuth({ children }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Comprobando sesión…</p>;
  if (error) return <p>Reintenta la comprobación de sesión para acceder a tu cuenta. <Link to="/login">Ir al acceso</Link></p>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}
