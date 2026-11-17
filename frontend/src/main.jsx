import React, { lazy, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { PlayerProvider, usePlayer } from './features/player/PlayerProvider';
import ErrorBoundary from './shared/components/ErrorBoundary';
import { AuthProvider, RequireAuth, useAuth } from './features/auth/AuthProvider';
import Icon from './shared/components/Icon';
import '@fontsource-variable/saira/wdth-italic.css';
import '@fontsource-variable/atkinson-hyperlegible-next/index.css';
import '@fontsource/share-tech-mono/400.css';
import '@fontsource/permanent-marker/400.css';
import './styles/base.css';
const Explore = lazy(() => import('./features/explore/ExplorePage'));
const Moods = lazy(() => import('./features/moods/MoodsPage'));
const Recommendations = lazy(() => import('./features/recommendations/RecommendationsPage'));
const Status = lazy(() => import('./features/status/StatusPage'));
const Auth = lazy(() => import('./features/auth/AuthPage'));
const Preferences = lazy(() => import('./features/auth/PreferencesPage'));
const Account = lazy(() => import('./features/auth/AccountPage'));
function Home() {
  return <section className="home">
    <h1>Música para cómo te sientes</h1>
    <p className="lede">Elige un mood y te preparamos 7 canciones que suenan a él, con tus artistas y algún descubrimiento. Cada visita trae otras.</p>
    <p className="actions"><Link className="button-link primary" to="/moods">Elegir un mood</Link><Link className="button-link" to="/explorar">Buscar música</Link></p>
  </section>;
}
const titles = { '/': 'Inicio', '/moods': 'Moods', '/explorar': 'Explorar', '/estado': 'Estado', '/login': 'Iniciar sesión', '/registro': 'Registro', '/preferencias': 'Preferencias', '/cuenta': 'Cuenta' };
function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigation = useNavigationType();
  const { setPageTitle } = usePlayer();
  useEffect(() => {
    const mood = location.pathname.match(/^\/recomendaciones\/([^/]+)/)?.[1];
    setPageTitle(`${mood ? `Mood ${decodeURIComponent(mood)}` : titles[location.pathname] || 'Página no encontrada'} | VibeTrack`);
    document.querySelector('main')?.focus({ preventScroll: true });
    // Al entrar a otra página se empieza arriba; con "Atrás"/"Adelante" el navegador conserva la posición.
    if (navigation !== 'POP') window.scrollTo(0, 0);
  }, [location.pathname]);
  const account = user ? '/cuenta' : '/login';
  const accountLabel = loading ? 'Cuenta' : user ? user.name : 'Entrar';
  return <><a className="skip" href="#content">Saltar al contenido</a>
    <header className="site-header"><Link className="brand" to="/">Vibe<span>Track</span></Link><nav className="site-nav" aria-label="Principal"><NavLink to="/moods">Moods</NavLink><NavLink to="/explorar">Explorar</NavLink><NavLink to="/estado">Estado</NavLink><NavLink to={account}>{accountLabel}</NavLink></nav></header>
    <main id="content" tabIndex="-1"><Suspense fallback={<p role="status">Cargando página…</p>}><Routes>
      <Route path="/" element={<Home />} />
      <Route path="/moods" element={<Moods />} /><Route path="/explorar" element={<Explore />} /><Route path="/recomendaciones/:mood" element={<Recommendations />} /><Route path="/estado" element={<Status />} />
      <Route path="/login" element={<Auth key="login" />} /><Route path="/registro" element={<Auth key="register" register />} />
      <Route path="/preferencias" element={<RequireAuth><Preferences /></RequireAuth>} /><Route path="/cuenta" element={<RequireAuth><Account /></RequireAuth>} />
      <Route path="*" element={<><h1>Página no encontrada</h1><p className="lede">Esa dirección no existe en VibeTrack.</p><Link to="/">Volver al inicio</Link></>} />
    </Routes></Suspense></main>
    <footer className="site-footer">VibeTrack · Previews de Deezer, datos de Last.fm y rasgos de audio de ReccoBeats</footer>
    <nav className="bottom-nav" aria-label="Principal (móvil)">
      <NavLink to="/moods"><Icon name="moods" />Moods</NavLink>
      <NavLink to="/explorar"><Icon name="search" />Explorar</NavLink>
      <NavLink to="/estado"><Icon name="status" />Estado</NavLink>
      <NavLink to={account}><Icon name="user" />{user ? 'Cuenta' : 'Entrar'}</NavLink>
    </nav></>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><BrowserRouter><AuthProvider><PlayerProvider><App /></PlayerProvider></AuthProvider></BrowserRouter></ErrorBoundary></React.StrictMode>);
