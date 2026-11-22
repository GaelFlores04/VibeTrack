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
import { PageBack, TrailProvider } from './navigationTrail';
import { WoodGrainDefs } from '../features/home/StudioObjects';

const Home = lazy(pageLoaders['/']);
const Explore = lazy(pageLoaders['/explorar']);
const Moods = lazy(pageLoaders['/moods']);
const Recommendations = lazy(pageLoaders['/recomendaciones']);
const Status = lazy(pageLoaders['/estado']);
const Auth = lazy(pageLoaders['/login']);
const Preferences = lazy(pageLoaders['/preferencias']);
const Account = lazy(pageLoaders['/cuenta']);
// Inyectada por Vite desde package.json; fuera de Vite (pruebas) no se muestra.
// eslint-disable-next-line no-undef
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

const PAGE_TITLES = {
  '/': 'El estudio', '/moods': 'El estante', '/explorar': 'La cabina', '/estado': 'Cuadro eléctrico',
  '/login': 'Entrar', '/registro': 'Crear cuenta', '/preferencias': 'La consola', '/cuenta': 'El perchero',
};

export default function App() {
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  const { setPageTitle } = usePlayer();
  const focusedPath = useRef(pathname);

  useEffect(() => {
    const mood = pathname.match(/^\/recomendaciones\/([^/]+)/)?.[1];
    setPageTitle(`${mood ? `Sesión ${decodeURIComponent(mood)}` : PAGE_TITLES[pathname] || 'Sala no encontrada'} | VibeTrack`);
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
    <TrailProvider>
      <a className="skip" href="#content">Saltar al contenido</a>
      <WoodGrainDefs />
      {APP_VERSION && <p className="app-version lcd-text" aria-label={`Versión ${APP_VERSION}`}>v{APP_VERSION}</p>}
      <SiteNavigation />
      <main id="content" tabIndex={-1}>
        <PageBack />
        <Suspense fallback={<div className="page-loading" role="status"><Icon name="disc" size={28} /><p>Encendiendo las luces del estudio…</p></div>}>
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
                  <h1>Esta sala no existe</h1>
                  <p>Esa puerta no lleva a ninguna parte del estudio.</p>
                  <Link className="button-link primary" to="/moods">Ir al estante</Link>
                </section>
              } />
            </Routes>
          </PageTransition>
        </Suspense>
      </main>
      <footer className="site-footer">
        <span>VibeTrack · estudio de escucha por mood</span>
        <ActionLink to="/estado" icon="status">Cuadro eléctrico</ActionLink>
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
    </TrailProvider>
  );
}
