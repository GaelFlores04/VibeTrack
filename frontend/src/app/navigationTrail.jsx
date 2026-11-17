import { createContext, useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../shared/components/Icon';

// Recorrido dentro de la app (por pestaña): permite que "Volver" diga a dónde lleva y vuelva a la
// página real de la que vienes (p. ej. de Preferencias a la tanda de Triste), no a un destino fijo.
const KEY = 'vibetrack:trail';
const LIMIT = 20;
const MOOD_NAMES = { feliz: 'Feliz', relajado: 'Relajado', motivado: 'Motivado', triste: 'Triste', romantico: 'Romántico', cansado: 'Cansado' };
const PAGE_NAMES = { '/': 'Inicio', '/moods': 'Moods', '/explorar': 'Explorar', '/cuenta': 'Tu cuenta', '/preferencias': 'Preferencias', '/estado': 'Estado de los servicios' };
// Destino lógico cuando no hay página anterior (entrada directa o recarga).
const PARENTS = { '/moods': '/', '/explorar': '/', '/cuenta': '/', '/preferencias': '/cuenta', '/estado': '/', '/login': '/', '/registro': '/' };
// Iniciar sesión o registrarse nunca es un destino de retorno: tras entrar, volver ahí no tiene sentido.
const NOT_A_DESTINATION = new Set(['/login', '/registro']);

export function pageName(pathname) {
  const mood = pathname.match(/^\/recomendaciones\/([^/]+)/)?.[1];
  if (mood) return MOOD_NAMES[decodeURIComponent(mood)] || decodeURIComponent(mood);
  return PAGE_NAMES[pathname] || 'Inicio';
}
const parentOf = pathname => pathname.startsWith('/recomendaciones/') ? '/moods' : PARENTS[pathname] || '/';

const read = () => { try { const value = JSON.parse(sessionStorage.getItem(KEY)); return Array.isArray(value) ? value : []; } catch { return []; } };
const write = value => { try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* Sin almacenamiento: el recorrido dura lo que la pestaña. */ } };

// Aplica la página actual al recorrido. Idempotente: repetirla con la misma página no cambia nada.
function advance(current, entry) {
  const top = current.at(-1);
  // Misma página con otra búsqueda (p. ej. ?tanda=3): se actualiza sin crear un paso nuevo.
  if (top?.pathname === entry.pathname) return [...current.slice(0, -1), entry];
  // Volver a la página anterior (con el navegador o con "Volver") retrocede un paso.
  if (current.at(-2)?.pathname === entry.pathname) return [...current.slice(0, -2), entry];
  return [...current, entry].slice(-LIMIT);
}

const TrailContext = createContext([]);
export function TrailProvider({ children }) {
  const { pathname, search } = useLocation();
  const [trail, setTrail] = useState(read);
  useEffect(() => {
    setTrail(current => { const next = advance(current, { pathname, search }); write(next); return next; });
  }, [pathname, search]);
  return <TrailContext.Provider value={trail}>{children}</TrailContext.Provider>;
}

export function useBackTarget() {
  const { pathname, search } = useLocation();
  // Se aplica ya la página actual: el efecto que guarda el recorrido llega un render después.
  const trail = advance(useContext(TrailContext), { pathname, search });
  for (let index = trail.length - 2; index >= 0; index--) {
    const entry = trail[index];
    if (entry.pathname !== pathname && !NOT_A_DESTINATION.has(entry.pathname)) return { to: `${entry.pathname}${entry.search || ''}`, label: pageName(entry.pathname) };
  }
  const parent = parentOf(pathname);
  return { to: parent, label: pageName(parent) };
}

// Retorno visible en todas las páginas salvo Inicio: nombra el destino y es un enlace real.
export function PageBack() {
  const { pathname } = useLocation();
  const target = useBackTarget();
  if (pathname === '/') return null;
  return <nav className="page-back" aria-label="Volver">
    <Link to={target.to}><Icon name="arrow-left" size={18} /><span>Volver a <strong>{target.label}</strong></span></Link>
  </nav>;
}
