import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { discTexture, isBlank } from './discTexture';
import DiscmanModel from './DiscmanModel';

// Medidas de la escena (unidades three.js).
const DISC_RADIUS = 0.82;
const DISC_HEIGHT = 0.014;
// El CD descansa sobre el pozo del reproductor (cara superior en y = 0.24).
const PLAYER = new Vector3(0.95, 0.258, 0.05);
const STACK = new Vector3(-2.15, -0.2, 0.55);
// Pila en abanico (D03): cada CD sube, retrocede y se desplaza para que asome el de abajo.
const FAN = { x: 0.07, y: 0.11, z: -0.2, tilt: 0.1 };
// Frente del reproductor, donde se acopla la pantalla LCD de HTML.
const LCD_ANCHOR = new Vector3(PLAYER.x, 0.11, PLAYER.z + 1.17);

const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
// Con frameloop "demand" el primer fotograma tras una pausa trae segundos de intervalo: se acota.
const step = dt => Math.min(dt, 1 / 30);
const hash = text => { let h = 0; for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const env = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.9;
    return () => { scene.environment = null; env.dispose(); generator.dispose(); };
  }, [gl, scene]);
  return null;
}

// Encuadre según el ancho: en móvil la cámara se aleja para que quepan pila y reproductor.
// Además proyecta el frente del reproductor para acoplar ahí la LCD de HTML (D02).
function CameraRig({ onAnchor }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const compact = aspect < 1.45;
    camera.position.set(compact ? -0.4 : -0.35, compact ? 4.6 : 3.55, compact ? 5.9 : 4.35);
    camera.lookAt(compact ? -0.4 : -0.5, 0.05, 0.25);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const point = LCD_ANCHOR.clone().project(camera);
    onAnchor?.({ x: (point.x + 1) / 2, y: (1 - point.y) / 2 });
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}

// Un CD: se dirige amortiguado a su sitio (pila o lector). Sube mientras viaja y baja al llegar,
// así un cambio a mitad de camino simplemente redirige el movimiento.
function Disc({ track, slot, inPlayer, spinning, motion, onPick }) {
  const group = useRef();
  const spinner = useRef();
  const [hovered, setHovered] = useState(false);
  const { invalidate } = useThree();
  const texture = useMemo(() => discTexture(track, invalidate), [track.id, track.previewUrl, track.previewStatus, track.artworkUrl]);
  // Un CD-R nunca suena: queda con el rótulo legible. Los demás, girados al azar como en una pila real.
  const turn = useMemo(() => (isBlank(track) ? 0 : (hash(track.id) % 360) * Math.PI / 180), [track.id, track.previewUrl, track.previewStatus]);
  const target = inPlayer ? PLAYER : new Vector3(STACK.x + slot * FAN.x, STACK.y + slot * FAN.y, STACK.z + slot * FAN.z);
  const tilt = inPlayer ? 0 : FAN.tilt;
  // Primer render ya en su sitio: sin animación de entrada al cargar la página.
  const [initial] = useState(() => target.clone());
  useEffect(() => { invalidate(); }, [inPlayer, slot, spinning, invalidate]);
  useFrame((state, raw) => {
    const dt = step(raw);
    const g = group.current;
    if (!g) return;
    const reduced = motion.current.reduced;
    const dx = target.x - g.position.x, dz = target.z - g.position.z;
    const far = Math.hypot(dx, dz) > 0.18;
    const lift = far ? 0.95 : hovered && !inPlayer ? 0.08 : 0;
    const k = reduced ? 1 : damp(dt, 6.5);
    g.rotation.x += (tilt - g.rotation.x) * k;
    g.position.x += dx * k;
    g.position.z += dz * k;
    g.position.y += (target.y + lift - g.position.y) * (reduced ? 1 : damp(dt, far ? 9 : 7));
    const moving = far || Math.abs(target.y + lift - g.position.y) > 0.004;
    const nearPlayer = Math.hypot(g.position.x - PLAYER.x, g.position.z - PLAYER.z) < DISC_RADIUS + 0.3;
    if (moving && (inPlayer || nearPlayer)) motion.current.lidUntil = state.clock.elapsedTime + 0.3;
    if (spinning && !reduced && spinner.current) spinner.current.rotation.y -= dt * 4.2;
    if (moving || (spinning && !reduced)) state.invalidate();
  });
  return <group ref={group} position={initial}
    onClick={inPlayer ? undefined : event => { event.stopPropagation(); onPick(track); }}
    onPointerOver={inPlayer ? undefined : event => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; invalidate(); }}
    onPointerOut={inPlayer ? undefined : () => { setHovered(false); document.body.style.cursor = ''; invalidate(); }}>
    <group ref={spinner} rotation={[0, turn, 0]}>
      <mesh>
        <cylinderGeometry args={[DISC_RADIUS, DISC_RADIUS, DISC_HEIGHT, 96, 1, true]} />
        <meshStandardMaterial color="#dfe6ee" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, -DISC_HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[DISC_RADIUS, 96]} />
        <meshStandardMaterial color="#cfd8e2" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0, DISC_HEIGHT / 2 + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[DISC_RADIUS, 96]} />
        <meshStandardMaterial map={texture} metalness={0.15} roughness={0.42} />
      </mesh>
    </group>
  </group>;
}

// D10: si las transiciones bajan de ~24 FPS, se reduce la resolución; si siguen lentas, respaldo estático.
function PerformanceGuard({ onSlow }) {
  const { setDpr, invalidate } = useThree();
  const samples = useRef([]);
  const level = useRef(0);
  useFrame((state, dt) => {
    // Sólo cuentan fotogramas seguidos de una animación; los huecos de inactividad no.
    if (dt > 0.25) { samples.current.length = 0; return; }
    const list = samples.current;
    list.push(dt);
    if (list.length < 45) return;
    const fps = list.length / list.reduce((sum, value) => sum + value, 0);
    list.length = 0;
    if (fps >= 24) return;
    if (level.current === 0) { level.current = 1; setDpr(1); invalidate(); }
    else if (fps < 16) onSlow?.();
  });
  return null;
}

export default function PlayerScene({ tracks, selectedId, playing, reduced, onPick, onSlow, onAnchor }) {
  const motion = useRef({ lidUntil: 0, reduced });
  motion.current.reduced = reduced;
  // La siguiente canción queda arriba de la pila.
  const start = Math.max(0, tracks.findIndex(track => track.id === selectedId));
  const ordered = [...tracks.slice(start + 1), ...tracks.slice(0, start)].filter(track => track.id !== selectedId);
  const slotOf = id => ordered.length - 1 - ordered.findIndex(track => track.id === id);
  return <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ fov: 32, near: 0.1, far: 40 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    onPointerMissed={() => { document.body.style.cursor = ''; }}>
    <Environment />
    <CameraRig onAnchor={onAnchor} />
    <ambientLight intensity={0.45} />
    <directionalLight position={[-3, 6, 4]} intensity={1.4} />
    <directionalLight position={[4, 3, -2]} intensity={0.5} color="#9fd8ff" />
    <DiscmanModel position={[PLAYER.x, 0, PLAYER.z]} motion={motion} />
    {tracks.map(track => <Disc key={track.id} track={track} slot={track.id === selectedId ? 0 : slotOf(track.id)} inPlayer={track.id === selectedId}
      spinning={track.id === selectedId && playing} motion={motion} onPick={onPick} />)}
    <PerformanceGuard onSlow={onSlow} />
  </Canvas>;
}
