import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { discTexture, sleeveTexture } from './discTexture';
import TurntableModel, { PLATTER, TOP, walnutTexture } from './TurntableModel';

// Medidas de la escena (unidades three.js). Vinilo de 12" y su funda cuadrada.
const VINYL_RADIUS = 0.95;
const VINYL_HEIGHT = 0.012;
const SLEEVE = 1.96;
const LEAN = -0.16;
// El tocadiscos manda en el centro; caja y funda acompañan a menor escala, dentro del encuadre.
const TURNTABLE = new Vector3(0.9, 0, 0);
const CRATE_SCALE = 0.7;
const DISPLAY_SCALE = 0.6;
// El vinilo descansa sobre la alfombrilla del plato.
const ON_PLATTER = new Vector3(TURNTABLE.x + PLATTER.x, TOP + PLATTER.height + VINYL_HEIGHT / 2 + 0.004, TURNTABLE.z + PLATTER.z);
// Caja de discos a la izquierda: la funda de delante es la siguiente canción.
const CRATE = new Vector3(-1.82, -0.22, 0.1);
const crateSlot = slot => new Vector3(CRATE.x, CRATE.y + (SLEEVE / 2 + 0.06) * CRATE_SCALE, CRATE.z + (0.62 - slot * 0.17) * CRATE_SCALE);
// Funda de lo que suena, apoyada detrás del tocadiscos, a la derecha.
const DISPLAY = new Vector3(2.78, 0.5, -1.15);
// Frente del zócalo, donde se acopla la placa de latón de HTML.
const PLATE_ANCHOR = new Vector3(TURNTABLE.x, 0.05, TURNTABLE.z + 1.3);
// 33⅓ rpm, en sentido horario visto desde arriba.
const RPM_33 = (33.333 / 60) * Math.PI * 2;

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
    scene.environmentIntensity = 0.32;
    return () => { scene.environment = null; env.dispose(); generator.dispose(); };
  }, [gl, scene]);
  return null;
}

// Encuadre según el ancho: en móvil la cámara se aleja para que quepan caja y tocadiscos.
// Además proyecta el frente del zócalo para acoplar ahí la placa de HTML.
function CameraRig({ onAnchor }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const compact = aspect < 1.45;
    camera.position.set(0.25, compact ? 6.6 : 4.7, compact ? 8.2 : 6.2);
    camera.lookAt(0.25, compact ? 0.1 : 0.05, compact ? 0.25 : 0.15);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const point = PLATE_ANCHOR.clone().project(camera);
    onAnchor?.({ x: (point.x + 1) / 2, y: (1 - point.y) / 2 });
    invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}

// La caja de discos: cuatro tablas de nogal abiertas por arriba.
function Crate() {
  const wood = useMemo(() => { const texture = walnutTexture([52, 30, 18]); texture.repeat.set(0.5, 0.18); return texture; }, []);
  const material = <meshStandardMaterial map={wood} color="#b98c62" roughness={0.6} />;
  const w = SLEEVE + 0.3, d = 1.6, h = 0.86, t = 0.07;
  return <group position={[CRATE.x, CRATE.y + (h / 2) * CRATE_SCALE, CRATE.z]} scale={CRATE_SCALE}>
    <mesh position={[0, -h / 2 + t / 2, 0]}><boxGeometry args={[w, t, d]} />{material}</mesh>
    <mesh position={[0, 0, d / 2]}><boxGeometry args={[w, h, t]} />{material}</mesh>
    <mesh position={[0, 0, -d / 2]}><boxGeometry args={[w, h, t]} />{material}</mesh>
    <mesh position={[-w / 2, 0, 0]}><boxGeometry args={[t, h, d]} />{material}</mesh>
    <mesh position={[w / 2, 0, 0]}><boxGeometry args={[t, h, d]} />{material}</mesh>
  </group>;
}

// Un disco: su funda (en la caja o apoyada como «lo que suena») y el vinilo, que sale de la funda
// en arco y se acuesta en el plato. Todo se dirige amortiguado: un cambio a mitad de camino redirige.
function Record({ track, slot, inPlayer, spinning, motion, onPick }) {
  const sleeve = useRef();
  const vinyl = useRef();
  const spinner = useRef();
  const [hovered, setHovered] = useState(false);
  const { invalidate } = useThree();
  const labels = useMemo(() => ({ disc: discTexture(track, invalidate), cover: sleeveTexture(track, invalidate) }), [track.id, track.previewUrl, track.previewStatus, track.artworkUrl]);
  const turn = useMemo(() => (hash(track.id) % 360) * Math.PI / 180, [track.id]);
  const sleeveTarget = inPlayer ? DISPLAY : crateSlot(slot);
  const sleeveTilt = inPlayer ? { x: -0.24, y: -0.5 } : { x: LEAN, y: 0 };
  const sleeveScale = inPlayer ? DISPLAY_SCALE : CRATE_SCALE;
  // Primer render ya en su sitio: sin animación de entrada al cargar la página.
  const [start] = useState(() => ({ sleeve: sleeveTarget.clone(), vinyl: (inPlayer ? ON_PLATTER : sleeveTarget).clone(), flat: inPlayer }));
  useEffect(() => { invalidate(); }, [inPlayer, slot, spinning, invalidate]);
  useFrame((state, raw) => {
    const dt = step(raw);
    const s = sleeve.current, v = vinyl.current;
    if (!s || !v) return;
    const reduced = motion.current.reduced;
    const k = reduced ? 1 : damp(dt, 6.5);
    // Funda: en la caja se levanta un poco al apuntarla, como al sacarla para mirarla.
    const pull = hovered && !inPlayer ? 0.26 : 0;
    s.position.x += (sleeveTarget.x - s.position.x) * k;
    s.position.z += (sleeveTarget.z - s.position.z) * k;
    s.position.y += (sleeveTarget.y + pull - s.position.y) * (reduced ? 1 : damp(dt, 9));
    s.rotation.x += (sleeveTilt.x - s.rotation.x) * k;
    s.rotation.y += (sleeveTilt.y - s.rotation.y) * k;
    s.scale.setScalar(s.scale.x + (sleeveScale - s.scale.x) * k);
    // Vinilo: dentro de su funda o en el plato; viaja alto y se acuesta al llegar.
    const target = inPlayer ? ON_PLATTER : s.position;
    const far = Math.hypot(target.x - v.position.x, target.z - v.position.z) > 0.2;
    const kv = reduced ? 1 : damp(dt, 5.5);
    v.position.x += (target.x - v.position.x) * kv;
    v.position.z += (target.z - v.position.z) * kv;
    v.position.y += (target.y + (far ? 1.1 : 0) - v.position.y) * (reduced ? 1 : damp(dt, far ? 8 : 6));
    const flat = inPlayer && !far;
    v.rotation.x += ((flat ? 0 : Math.PI / 2 + s.rotation.x) - v.rotation.x) * kv;
    v.rotation.y += ((flat ? 0 : s.rotation.y) - v.rotation.y) * kv;
    // Dentro de la funda el vinilo tiene su escala; en el plato, tamaño real.
    v.scale.setScalar(v.scale.x + ((inPlayer ? 1 : CRATE_SCALE) - v.scale.x) * kv);
    if (spinning && !reduced && spinner.current) spinner.current.rotation.y -= dt * RPM_33;
    const moving = far || Math.abs(target.y - v.position.y) > 0.004 || Math.abs(sleeveTarget.y + pull - s.position.y) > 0.004
      || Math.abs(sleeveTarget.x - s.position.x) > 0.004 || Math.abs((flat ? 0 : Math.PI / 2 + s.rotation.x) - v.rotation.x) > 0.004
      || Math.abs(sleeveScale - s.scale.x) > 0.004 || Math.abs((inPlayer ? 1 : CRATE_SCALE) - v.scale.x) > 0.004;
    if (moving || (spinning && !reduced)) state.invalidate();
  });
  const pick = inPlayer ? undefined : event => { event.stopPropagation(); onPick(track); };
  return <>
    <group ref={sleeve} position={start.sleeve} rotation={[inPlayer ? -0.24 : LEAN, inPlayer ? -0.5 : 0, 0]} scale={sleeveScale}
      onClick={pick}
      onPointerOver={inPlayer ? undefined : event => { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; invalidate(); }}
      onPointerOut={inPlayer ? undefined : () => { setHovered(false); document.body.style.cursor = ''; invalidate(); }}>
      <mesh><boxGeometry args={[SLEEVE, SLEEVE, 0.035]} /><meshStandardMaterial color="#2a1d14" roughness={0.8} /></mesh>
      <mesh position={[0, 0, 0.0185]}><planeGeometry args={[SLEEVE, SLEEVE]} /><meshStandardMaterial map={labels.cover} roughness={0.7} /></mesh>
    </group>
    <group ref={vinyl} position={start.vinyl} rotation={[start.flat ? 0 : Math.PI / 2 + LEAN, 0, 0]} scale={start.flat ? 1 : CRATE_SCALE}>
      <group ref={spinner} rotation={[0, turn, 0]}>
        <mesh>
          <cylinderGeometry args={[VINYL_RADIUS, VINYL_RADIUS, VINYL_HEIGHT, 96, 1, true]} />
          <meshStandardMaterial color="#0b0908" roughness={0.4} />
        </mesh>
        <mesh position={[0, VINYL_HEIGHT / 2 + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[VINYL_RADIUS, 96]} />
          <meshStandardMaterial map={labels.disc} metalness={0.25} roughness={0.32} />
        </mesh>
        <mesh position={[0, -VINYL_HEIGHT / 2 - 0.0005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[VINYL_RADIUS, 96]} />
          <meshStandardMaterial color="#0b0908" roughness={0.4} />
        </mesh>
      </group>
    </group>
  </>;
}

// Si las transiciones bajan de ~24 FPS, se reduce la resolución; si siguen lentas, respaldo estático.
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
  const motion = useRef({ reduced });
  motion.current.reduced = reduced;
  // La siguiente canción queda delante en la caja.
  const start = Math.max(0, tracks.findIndex(track => track.id === selectedId));
  const ordered = [...tracks.slice(start + 1), ...tracks.slice(0, start)].filter(track => track.id !== selectedId);
  const slotOf = id => ordered.findIndex(track => track.id === id);
  return <Canvas frameloop="demand" dpr={[1, 1.75]} camera={{ fov: 30, near: 0.1, far: 50 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    onPointerMissed={() => { document.body.style.cursor = ''; }}>
    <Environment />
    <CameraRig onAnchor={onAnchor} />
    <ambientLight intensity={0.35} color="#ffd9b0" />
    {/* Foco de tungsteno sobre el plato y contraluz ámbar desde el fondo del estudio. */}
    <directionalLight position={[-2, 7, 4]} intensity={2.1} color="#ffc68f" />
    <directionalLight position={[5, 3, -4]} intensity={0.9} color="#ff9a5c" />
    <TurntableModel position={[TURNTABLE.x, TURNTABLE.y, TURNTABLE.z]} motion={motion} playing={playing} />
    <Crate />
    {tracks.map(track => <Record key={track.id} track={track} slot={track.id === selectedId ? 0 : slotOf(track.id)} inPlayer={track.id === selectedId}
      spinning={track.id === selectedId && playing} motion={motion} onPick={onPick} />)}
    <PerformanceGuard onSlow={onSlow} />
  </Canvas>;
}
