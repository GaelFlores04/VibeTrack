import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { RequireAuth } from '../features/auth/AuthProvider';
import { usePlayer } from '../features/player/PlayerProvider';
import SiteNavigation from './SiteNavigation';
import PageTransition from '../shared/components/PageTransition';
import { pageLoaders } from './pageLoaders';
import ActionLink from '../shared/components/ActionLink';
import Icon from '../shared/components/Icon';
import { installKeyboardNavigation } from '../shared/keyboardNavigation';

const Home = lazy(pageLoaders['/']);
const Explore = lazy(pageLoaders['/explorar']);
const Moods = lazy(pageLoaders['/moods']);
const Recommendations = lazy(pageLoaders['/recomendaciones']);
const Status = lazy(pageLoaders['/estado']);
const Auth = lazy(pageLoaders['/login']);
const Preferences = lazy(pageLoaders['/preferencias']);
const Account = lazy(pageLoaders['/cuenta']);

const PAGE_TITLES = {
  '/': 'Inicio', '/moods': 'Moods', '/explorar': 'Explorar', '/estado': 'Estado',
  '/login': 'Iniciar sesión', '/registro': 'Registro', '/preferencias': 'Preferencias', '/cuenta': 'Cuenta',
};

export default function App() {
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  const { setPageTitle } = usePlayer();
  const focusedPath = useRef(pathname);

  useEffect(() => {
    const mood = pathname.match(/^\/recomendaciones\/([^/]+)/)?.[1];
    setPageTitle(`${mood ? `Mood ${decodeURIComponent(mood)}` : PAGE_TITLES[pathname] || 'Página no encontrada'} | VibeTrack`);
    if (focusedPath.current !== pathname) document.getElementById('content')?.focus({ preventScroll: true });
    focusedPath.current = pathname;
    if (navigation !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, navigation, setPageTitle]);

  useEffect(() => {
    const keyboard = () => { document.documentElement.dataset.input = 'keyboard'; };
    const pointer = () => { document.documentElement.dataset.input = 'pointer'; };
    window.addEventListener('keydown', keyboard, true);
    window.addEventListener('pointerdown', pointer, true);
    return () => {
      window.removeEventListener('keydown', keyboard, true);
      window.removeEventListener('pointerdown', pointer, true);
    };
  }, []);

  useEffect(() => installKeyboardNavigation(document), []);

  return (
    <>
      <a className="skip" href="#content">Saltar al contenido</a>
      <SiteNavigation />
      <main id="content" tabIndex={-1}>
        <Suspense fallback={<div className="page-loading" role="status"><Icon name="disc" size={28} /><p>Preparando tu espacio…</p></div>}>
          <PageTransition pageKey={pathname}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/moods" element={<Moods />} />
              <Route path="/explorar" element={<Explore />} />
              <Route path="/recomendaciones/:mood" element={<Recommendations />} />
              <Route path="/estado" element={<Status />} />
              <Route path="/login" element={<Auth key="login" />} />
              <Route path="/registro" element={<Auth key="register" register />} />
              <Route path="/preferencias" element={<RequireAuth><Preferences /></RequireAuth>} />
              <Route path="/cuenta" element={<RequireAuth><Account /></RequireAuth>} />
              <Route path="*" element={
                <section className="empty-state">
                  <h1>Página no encontrada</h1>
                  <p>Esa dirección no existe en VibeTrack.</p>
                  <Link className="button-link primary" to="/moods">Elegir un mood</Link>
                </section>
              } />
            </Routes>
          </PageTransition>
        </Suspense>
      </main>
      <footer className="site-footer">
        <span>VibeTrack · Música para tu momento</span>
        <ActionLink to="/estado" icon="status">Estado de los servicios</ActionLink>
        <span className="footer-sources">Previews de Deezer · Datos de Last.fm · Audio de ReccoBeats</span>
        <details className="keyboard-help">
          <summary>Guía de teclado</summary>
          <dl>
            <dt>Tab / Mayús + Tab</dt><dd>Avanzar o volver entre controles.</dd>
            <dt>Flechas</dt><dd>Mover el foco por menús, cards y listas. En campos de texto y deslizadores mantienen su función habitual.</dd>
            <dt>Inicio / Fin</dt><dd>Ir al primer o último control de un grupo.</dd>
            <dt>Enter / Espacio</dt><dd>Enter abre enlaces; Enter o Espacio activa botones y casillas.</dd>
            <dt>Escape</dt><dd>Cerrar sugerencias o la cola del reproductor.</dd>
          </dl>
        </details>
      </footer>
    </>
  );
}
