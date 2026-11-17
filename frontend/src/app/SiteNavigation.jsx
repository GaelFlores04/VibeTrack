import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import Icon from '../shared/components/Icon';
import { preloadPage } from './pageLoaders';

export default function SiteNavigation() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const inMood = pathname.startsWith('/recomendaciones/');
  const items = [
    { to: '/', label: 'Inicio', icon: 'home', end: true },
    { to: '/moods', label: 'Moods', icon: 'moods', active: inMood },
    { to: '/explorar', label: 'Explorar', icon: 'search' },
    { to: user ? '/cuenta' : '/login', label: user || loading ? 'Cuenta' : 'Entrar', icon: 'user' },
  ];

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
          {mobile && <Icon name={icon} />}
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
        <nav className="site-nav" aria-label="Principal" data-keyboard-group="linear"><ul>{navigationLinks()}</ul></nav>
        <Link className="header-shortcut" to="/explorar" aria-label="Buscar música"><Icon name="search" /></Link>
      </header>
      <nav className="bottom-nav" aria-label="Principal en móvil" data-keyboard-group="linear"><ul>{navigationLinks(true)}</ul></nav>
    </>
  );
}
