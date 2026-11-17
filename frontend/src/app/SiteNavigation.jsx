import { useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import Icon from '../shared/components/Icon';
import { preloadPage } from './pageLoaders';

export default function SiteNavigation() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const inMood = pathname.startsWith('/recomendaciones/');
  const inAccount = pathname === '/preferencias';
  const items = [
    { to: '/', label: 'Inicio', icon: 'home', end: true },
    { to: '/moods', label: 'Moods', icon: 'moods', active: inMood },
    { to: '/explorar', label: 'Explorar', icon: 'search' },
    // Preferencias vive dentro de la cuenta: la pestaña sigue marcada al ajustarlas.
    { to: user ? '/cuenta' : '/login', label: user || loading ? 'Cuenta' : 'Entrar', icon: 'user', active: inAccount },
  ];

  // Indicador celeste que se desliza hasta la sección activa (escritorio). Se mide el enlace real
  // para seguir su ancho con cualquier etiqueta o tamaño de fuente.
  const nav = useRef(null);
  const [indicator, setIndicator] = useState(null);
  const [animated, setAnimated] = useState(false);
  useLayoutEffect(() => {
    const measure = () => {
      const container = nav.current;
      const active = container?.querySelector('a.active');
      if (!container || !active) { setIndicator(null); return; }
      const box = container.getBoundingClientRect(), link = active.getBoundingClientRect();
      setIndicator({ x: link.left - box.left, width: link.width });
    };
    measure();
    // La primera posición aparece sin deslizarse; sólo los cambios de sección se animan.
    const frame = requestAnimationFrame(() => setAnimated(true));
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (nav.current) observer?.observe(nav.current);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); };
  }, [pathname, user, loading]);

  function navigationLinks(mobile = false) {
    return items.map(({ to, label, icon, end, active }) => (
      <li key={to}>
        <NavLink
          to={to}
          end={end}
          className={({ isActive }) => isActive || active ? 'active' : undefined}
          aria-current={active ? 'page' : undefined}
          onPointerEnter={() => preloadPage(to)}
          onFocus={() => preloadPage(to)}
          onTouchStart={() => preloadPage(to)}
        >
          {mobile ? <span className="nav-icon"><Icon name={icon} /></span> : <Icon name={icon} size={18} />}
          <span>{label}</span>
        </NavLink>
      </li>
    ));
  }

  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="VibeTrack, inicio">
          <Icon name="disc" size={29} />Vibe<span>Track</span>
        </Link>
        <nav className="site-nav" ref={nav} aria-label="Principal" data-keyboard-group="linear">
          <ul>{navigationLinks()}</ul>
          {indicator && <span className={`nav-indicator${animated ? ' is-animated' : ''}`} aria-hidden="true"
            style={{ transform: `translateX(${indicator.x}px)`, width: indicator.width }} />}
        </nav>
        {pathname !== '/explorar' && <Link className="header-shortcut" to="/explorar" aria-label="Buscar música"><Icon name="search" /></Link>}
      </header>
      <nav className="bottom-nav" aria-label="Principal en móvil" data-keyboard-group="linear"><ul>{navigationLinks(true)}</ul></nav>
    </>
  );
}
