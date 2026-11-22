import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { usePlayer } from '../features/player/PlayerProvider';
import { preloadPage } from './pageLoaders';

// Sin barra de navegación: el estudio tiene una placa en la puerta, la lámpara EN EL AIRE y un plano
// de las salas. Cada sala es un objeto del estudio y es un enlace real (teclado y lectores de pantalla).
function rooms(user, loading) {
  return [
    { to: '/', area: 'room', name: 'El cuarto', what: 'Inicio: el estudio completo', end: true },
    { to: '/moods', area: 'shelf', name: 'El estante', what: 'Moods: saca una caja y empieza una sesión', match: path => path.startsWith('/recomendaciones/') },
    { to: '/explorar', area: 'booth', name: 'La cabina', what: 'Explorar: pide una canción concreta' },
    { to: '/preferencias', area: 'console', name: 'La consola', what: 'Preferencias: ajusta tus gustos' },
    { to: user ? '/cuenta' : '/login', area: 'coats', name: 'El perchero', what: user || loading ? 'Tu cuenta y Spotify' : 'Entrar o crear cuenta', match: path => ['/cuenta', '/login', '/registro'].includes(path) },
    { to: '/estado', area: 'fuses', name: 'Cuadro eléctrico', what: 'Estado de los servicios' },
  ];
}

// Lámpara EN EL AIRE: se enciende sólo con reproducción confirmada y lleva a la sesión que suena.
function OnAirLamp() {
  const { track, status, source } = usePlayer();
  const lit = status === 'playing';
  const label = track ? `${track.title} — ${track.artist}` : 'Nada suena todavía';
  const content = <><span className="on-air-sign">EN EL AIRE</span><span className="on-air-track">{track ? <><strong>{track.title}</strong> · {track.artist}</> : 'Silencio en el estudio'}</span></>;
  if (track && source?.path) return <Link className={`on-air${lit ? ' is-lit' : ''}`} to={source.path} aria-label={`${lit ? 'En el aire' : 'En pausa'}: ${label}. Volver a ${source.label}`}>{content}</Link>;
  return <p className="on-air" aria-label={label}>{content}</p>;
}

export default function SiteNavigation() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  const plan = useRef(null);
  const list = rooms(user, loading);
  const here = list.find(room => (room.end ? pathname === room.to : pathname === room.to || room.match?.(pathname)));

  // El plano se cierra al cambiar de sala, con Escape o al pulsar fuera; el foco vuelve al botón.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    plan.current?.querySelector('a[aria-current="page"], a')?.focus({ preventScroll: true });
    const onKey = event => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    const onPointer = event => { if (!plan.current?.contains(event.target) && !toggle.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [open]);

  return (
    <header className="studio-door">
      <Link className="studio-plate" to="/" aria-label="VibeTrack, volver al cuarto del estudio">
        VibeTrack<small>Estudio de escucha</small>
      </Link>
      <OnAirLamp />
      <div className="plan-anchor">
        <button ref={toggle} type="button" className="plan-toggle" aria-expanded={open} aria-controls="studio-plan" onClick={() => setOpen(value => !value)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 4h18v16H3zM3 11h7m4 0h7M10 4v5m0 4v7M14 11v9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <span>Plano<span className="plan-long"> del estudio</span></span>{here && <small>{here.name}</small>}
        </button>
        {open && <nav ref={plan} id="studio-plan" className="studio-plan" aria-label="Plano del estudio" data-keyboard-group="linear">
          <p className="plan-title">Plano · planta baja</p>
          <ul>{list.map(room => {
            const current = room === here;
            return <li key={room.area} className={`plan-room room-${room.area}`}>
              <Link to={room.to} aria-current={current ? 'page' : undefined}
                onPointerEnter={() => preloadPage(room.to)} onFocus={() => preloadPage(room.to)}>
                <strong>{room.name}</strong><span>{room.what}</span>{current && <em>Estás aquí</em>}
              </Link>
            </li>;
          })}</ul>
        </nav>}
      </div>
    </header>
  );
}
