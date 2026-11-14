import React, { lazy, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { PlayerProvider } from './features/player/PlayerProvider';
import ErrorBoundary from './shared/components/ErrorBoundary';
import { AuthProvider, RequireAuth, useAuth } from './features/auth/AuthProvider';
import './styles/base.css';
const Explore = lazy(() => import('./features/explore/ExplorePage'));
const Moods = lazy(() => import('./features/moods/MoodsPage'));
const Recommendations = lazy(() => import('./features/recommendations/RecommendationsPage'));
const Status = lazy(() => import('./features/status/StatusPage'));
const Auth = lazy(() => import('./features/auth/AuthPage'));
const Preferences = lazy(() => import('./features/auth/PreferencesPage'));
const Account = lazy(() => import('./features/auth/AccountPage'));
function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  useEffect(() => {
    document.title = `${location.pathname === '/' ? 'Inicio' : location.pathname.split('/')[1]} | VibeTrack`;
    document.querySelector('main')?.focus();
  }, [location.pathname]);
  return <PlayerProvider><a className="skip" href="#content">Saltar al contenido</a><header><Link className="brand" to="/">VibeTrack</Link><nav aria-label="Principal"><NavLink to="/moods">Moods</NavLink><NavLink to="/explorar">Explorar</NavLink><NavLink to="/estado">Estado</NavLink>{!loading && <NavLink to={user ? '/cuenta' : '/login'}>{user ? user.name : 'Iniciar sesión'}</NavLink>}</nav></header>
    <main id="content" tabIndex="-1"><Suspense fallback={<p role="status">Cargando página…</p>}><Routes>
      <Route path="/" element={<><h1>Encuentra música para tu momento</h1><p>Primera versión funcional de VibeTrack. Busca música, consulta sus datos y escucha previews promocionales.</p><p><Link to="/explorar">Empezar a buscar</Link> · <Link to="/moods">Elegir un mood</Link></p></>} />
      <Route path="/moods" element={<Moods />} /><Route path="/explorar" element={<Explore />} /><Route path="/recomendaciones/:mood" element={<Recommendations />} /><Route path="/estado" element={<Status />} />
      <Route path="/login" element={<Auth key="login" />} /><Route path="/registro" element={<Auth key="register" register />} />
      <Route path="/preferencias" element={<RequireAuth><Preferences /></RequireAuth>} /><Route path="/cuenta" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="*" element={<><h1>Página no encontrada</h1><Link to="/">Volver al inicio</Link></>} />
    </Routes></Suspense></main><footer>VibeTrack · Base funcional en desarrollo</footer></PlayerProvider>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></ErrorBoundary></React.StrictMode>);
