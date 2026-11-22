// Objetos del estudio dibujados a mano en SVG (trazo y relleno de la paleta). Son la ilustración de
// cada puerta; el texto del enlace dice siempre a dónde lleva.

export function TurntableArt({ playing = false, cover }) {
  return <svg className={`turntable-art${playing ? ' is-playing' : ''}`} viewBox="0 0 420 300" aria-hidden="true">
    <defs>
      <radialGradient id="tt-grooves" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#1c1612" /><stop offset=".7" stopColor="#0c0907" /><stop offset="1" stopColor="#060404" />
      </radialGradient>
      <clipPath id="tt-label"><circle cx="160" cy="146" r="34" /></clipPath>
      <filter id="tt-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".018 .32" numOctaves="3" seed="5" />
        <feColorMatrix values="0 0 0 0 .2  0 0 0 0 .11  0 0 0 0 .05  0 0 0 .9 0" />
      </filter>
      <radialGradient id="tt-pool" cx="42%" cy="38%" r="62%">
        <stop offset="0" stopColor="#ffb469" stopOpacity=".34" /><stop offset="1" stopColor="#ffb469" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="18" y="34" width="384" height="240" rx="18" fill="#6a3f22" />
    <rect x="18" y="34" width="384" height="240" rx="18" fill="#000" filter="url(#tt-grain)" opacity=".75" />
    <rect x="18" y="34" width="384" height="240" rx="18" fill="url(#tt-pool)" />
    <rect x="18.5" y="34.5" width="383" height="239" rx="17.5" fill="none" stroke="#ffcf9a" strokeOpacity=".22" />
    <rect x="26" y="42" width="368" height="224" rx="12" fill="none" stroke="#7a4f2c" strokeOpacity=".6" />
    <circle cx="160" cy="146" r="108" fill="#bdb3a4" />
    <circle cx="160" cy="146" r="102" fill="#1a1512" />
    <g className="tt-record">
      <circle cx="160" cy="146" r="98" fill="url(#tt-grooves)" />
      {[88, 78, 68, 58, 48].map(r => <circle key={r} cx="160" cy="146" r={r} fill="none" stroke="#2b2320" strokeWidth="1" />)}
      <path d="M100 90a86 86 0 0 1 40-26" stroke="#f4a259" strokeOpacity=".35" strokeWidth="6" fill="none" strokeLinecap="round" />
      {cover ? <image href={cover} x="126" y="112" width="68" height="68" clipPath="url(#tt-label)" preserveAspectRatio="xMidYMid slice" />
        : <circle cx="160" cy="146" r="34" fill="#7a1f1f" />}
      <circle cx="160" cy="146" r="4" fill="#0b0908" />
    </g>
    <circle cx="330" cy="84" r="22" fill="#c9c2b8" />
    <circle cx="330" cy="84" r="9" fill="#1a1512" />
    <g className="tt-arm">
      <path d="M330 84 L326 196 L300 230" stroke="#d8d0c4" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="286" y="224" width="22" height="14" rx="3" fill="#1a1512" transform="rotate(-36 297 231)" />
    </g>
    <circle cx="52" cy="246" r="10" fill="#c9c2b8" />
    <circle className="tt-pilot" cx="80" cy="246" r="5" fill="#f4a259" />
  </svg>;
}

export function BoothArt() {
  return <svg className="room-art" viewBox="0 0 160 120" aria-hidden="true">
    <rect x="8" y="10" width="144" height="100" rx="6" fill="#2a1a10" stroke="#8a5a32" strokeWidth="3" />
    <rect x="18" y="20" width="124" height="60" rx="3" fill="#160e09" />
    <path d="M18 20 L70 80 M60 20 L112 80" stroke="#f4a259" strokeOpacity=".12" strokeWidth="10" />
    <path d="M80 92 v-22 M72 70 a8 8 0 0 1 16 0 v10 a8 8 0 0 1 -16 0z" stroke="#e9dcc4" strokeWidth="3" fill="none" strokeLinecap="round" />
    <rect x="58" y="94" width="44" height="6" rx="3" fill="#8a5a32" />
  </svg>;
}

export function ConsoleArt() {
  return <svg className="room-art" viewBox="0 0 160 120" aria-hidden="true">
    <path d="M8 34 L152 18 L152 104 L8 104 Z" fill="#2a1a10" stroke="#8a5a32" strokeWidth="3" strokeLinejoin="round" />
    {[0, 1, 2, 3, 4, 5].map(i => {
      const x = 26 + i * 22;
      const y = 74 - ((i * 37) % 30);
      return <g key={i}>
        <line x1={x} y1="52" x2={x} y2="96" stroke="#0c0806" strokeWidth="5" strokeLinecap="round" />
        <rect x={x - 7} y={y} width="14" height="9" rx="2" fill={i === 2 ? '#f4a259' : '#d8d0c4'} />
        <circle cx={x} cy={38 - i * 2.4} r="5" fill="#c9c2b8" />
      </g>;
    })}
  </svg>;
}

export function CoatsArt() {
  return <svg className="room-art" viewBox="0 0 160 120" aria-hidden="true">
    <rect x="20" y="14" width="120" height="10" rx="4" fill="#8a5a32" />
    {[48, 112].map(x => <path key={x} d={`M${x} 24 v10 q0 8 -8 8`} stroke="#c9a26a" strokeWidth="4" fill="none" strokeLinecap="round" />)}
    <path d="M46 44 a32 32 0 0 1 64 0" stroke="#e9dcc4" strokeWidth="7" fill="none" strokeLinecap="round" />
    <rect x="36" y="56" width="20" height="34" rx="9" fill="#2a1a10" stroke="#e9dcc4" strokeWidth="3" />
    <rect x="100" y="56" width="20" height="34" rx="9" fill="#2a1a10" stroke="#e9dcc4" strokeWidth="3" />
    <path d="M46 90 q34 26 64 0" stroke="#7a1f1f" strokeWidth="3" fill="none" />
  </svg>;
}

// Patrón de veta compartido por las ilustraciones (una sola definición en el documento).
export function WoodGrainDefs() {
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
    <defs>
      <pattern id="wood-grain" width="240" height="60" patternUnits="userSpaceOnUse">
        <path d="M0 10 C60 4 120 16 240 8 M0 26 C80 20 140 32 240 24 M0 44 C70 38 150 50 240 42" stroke="#1a0e07" strokeOpacity=".35" strokeWidth="2" fill="none" />
        <path d="M0 18 C90 14 150 22 240 16 M0 52 C60 48 170 58 240 50" stroke="#a06a3c" strokeOpacity=".22" strokeWidth="1.5" fill="none" />
      </pattern>
    </defs>
  </svg>;
}
