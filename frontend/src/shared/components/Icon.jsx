// Iconos de trazo único (24×24, 2 px), dibujados para VibeTrack. Siempre decorativos:
// el nombre accesible lo lleva el botón que los contiene.
const paths = {
  home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9Z" /></>,
  'arrow-right': <><path d="M4 12h16M14 6l6 6-6 6" /></>,
  'arrow-left': <><path d="M20 12H4M10 6l-6 6 6 6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  slides: <><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M2 7v10M22 7v10" /></>,
  play: <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  previous: <><path d="M19 20 9 12l10-8v16Z" /><path d="M5 19V5" /></>,
  next: <><path d="m5 4 10 8-10 8V4Z" /><path d="M19 5v14" /></>,
  close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  queue: <><path d="M4 6h12" /><path d="M4 12h12" /><path d="M4 18h8" /><path d="m17 15 4 3-4 3v-6Z" fill="currentColor" /></>,
  back: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  volume: <><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></>,
  disc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /></>,
  moods: <><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  status: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
};
export default function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
