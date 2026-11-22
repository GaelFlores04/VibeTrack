import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, ExtrudeGeometry, RepeatWrapping, Shape, SRGBColorSpace } from 'three';

// Tocadiscos de estudio modelado en código: zócalo de nogal, plato de aluminio con alfombrilla,
// brazo con contrapeso que se posa sobre el disco sólo cuando el audio suena, botón de arranque,
// selector 33/45 y piloto ámbar. Coordenadas locales; la cara superior del zócalo queda en y = TOP.
export const TOP = 0.24;
export const PLATTER = { x: -0.34, z: 0.04, radius: 1.02, height: 0.07 };
const WIDTH = 3.3;
const DEPTH = 2.45;
const HEIGHT = 0.3;
const PIVOT = { x: 1.18, z: -0.74 };
const ARM_LENGTH = 1.62;
const REST_ANGLE = 0.1;
const PLAY_ANGLE = -0.54;

const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
const step = dt => Math.min(dt, 1 / 30);

function roundedRect(width, depth, radius) {
  const shape = new Shape();
  const x = -width / 2, y = -depth / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

// Veta de nogal: bandas onduladas con nudos suaves, generadas una vez en un canvas.
export function walnutTexture(base = [58, 34, 20]) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 140; i++) {
    const y0 = Math.random() * size;
    const amp = 4 + Math.random() * 10;
    const freq = 0.006 + Math.random() * 0.01;
    const tone = Math.random() < 0.5 ? -1 : 1;
    const strength = 8 + Math.random() * 22;
    ctx.strokeStyle = `rgba(${base[0] + tone * strength},${base[1] + tone * strength * 0.7},${base[2] + tone * strength * 0.5},.35)`;
    ctx.lineWidth = 0.6 + Math.random() * 2.2;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + i) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function softShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(8, 4, 2, .75)');
  gradient.addColorStop(1, 'rgba(8, 4, 2, 0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

export default function TurntableModel({ position, motion, playing }) {
  const arm = useRef();
  const angle = useRef(REST_ANGLE);
  const lift = useRef(0.08);
  const pilot = useRef();
  const assets = useMemo(() => {
    const plinth = new ExtrudeGeometry(roundedRect(WIDTH, DEPTH, 0.14), { depth: HEIGHT - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4, curveSegments: 12 });
    plinth.rotateX(-Math.PI / 2);
    plinth.translate(0, TOP - HEIGHT + 0.03, 0);
    const wood = walnutTexture();
    wood.repeat.set(0.35, 0.35);
    return { plinth, wood, shadow: softShadowTexture() };
  }, []);

  useFrame((state, raw) => {
    const dt = step(raw);
    const reduced = motion.current.reduced;
    // El brazo va al disco sólo con reproducción confirmada; si no, vuelve a su apoyo.
    const targetAngle = playing ? PLAY_ANGLE : REST_ANGLE;
    const targetLift = playing ? 0 : 0.08;
    const k = reduced ? 1 : damp(dt, 3.2);
    angle.current += (targetAngle - angle.current) * k;
    // Primero gira y después baja la cápsula (al subir, al revés), como la palanca de un tocadiscos.
    const swung = Math.abs(targetAngle - angle.current) < 0.03;
    const liftTarget = playing ? (swung ? targetLift : 0.08) : 0.08;
    lift.current += (liftTarget - lift.current) * (reduced ? 1 : damp(dt, 6));
    if (arm.current) { arm.current.rotation.y = angle.current; arm.current.position.y = TOP + 0.2 + lift.current; }
    if (pilot.current) pilot.current.emissiveIntensity += ((playing ? 2.4 : 0.15) - pilot.current.emissiveIntensity) * (reduced ? 1 : damp(dt, 8));
    if (Math.abs(targetAngle - angle.current) > 0.002 || Math.abs(liftTarget - lift.current) > 0.002) state.invalidate();
  });

  const aluminium = <meshStandardMaterial color="#c9c2b8" metalness={0.85} roughness={0.32} />;
  const brass = <meshStandardMaterial color="#b98a4a" metalness={0.8} roughness={0.35} />;
  const black = <meshStandardMaterial color="#141110" metalness={0.2} roughness={0.6} />;

  return <group position={position}>
    <mesh position={[0, -0.09, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[WIDTH * 1.35, DEPTH * 1.45]} />
      <meshBasicMaterial map={assets.shadow} transparent depthWrite={false} />
    </mesh>

    {/* Zócalo de nogal con patas */}
    <mesh geometry={assets.plinth}><meshStandardMaterial map={assets.wood} color="#c79a6e" metalness={0.05} roughness={0.55} /></mesh>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x * (WIDTH / 2 - 0.25), TOP - HEIGHT - 0.03, z * (DEPTH / 2 - 0.25)]}>
      <cylinderGeometry args={[0.13, 0.15, 0.09, 24]} />
      {black}
    </mesh>)}

    {/* Plato, alfombrilla y eje */}
    <mesh position={[PLATTER.x, TOP + PLATTER.height / 2, PLATTER.z]}>
      <cylinderGeometry args={[PLATTER.radius, PLATTER.radius, PLATTER.height, 96]} />
      {aluminium}
    </mesh>
    <mesh position={[PLATTER.x, TOP + PLATTER.height + 0.002, PLATTER.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[PLATTER.radius - 0.03, 96]} />
      <meshStandardMaterial color="#1d1917" roughness={0.95} />
    </mesh>
    <mesh position={[PLATTER.x, TOP + PLATTER.height + 0.04, PLATTER.z]}>
      <cylinderGeometry args={[0.022, 0.022, 0.08, 16]} />
      {aluminium}
    </mesh>

    {/* Brazo: base, apoyo, contrapeso, tubo y cápsula */}
    <mesh position={[PIVOT.x, TOP + 0.08, PIVOT.z]}>
      <cylinderGeometry args={[0.2, 0.22, 0.16, 40]} />
      {aluminium}
    </mesh>
    <mesh position={[PIVOT.x + 0.13, TOP + 0.14, PIVOT.z + 1.29]}>
      <cylinderGeometry args={[0.035, 0.035, 0.28, 12]} />
      {black}
    </mesh>
    <group ref={arm} position={[PIVOT.x, TOP + 0.28, PIVOT.z]} rotation={[0, REST_ANGLE, 0]}>
      <mesh position={[0, 0, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 28]} />
        {black}
      </mesh>
      <mesh position={[0, 0, ARM_LENGTH / 2 - 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, ARM_LENGTH, 12]} />
        {aluminium}
      </mesh>
      <mesh position={[-0.03, -0.04, ARM_LENGTH - 0.08]} rotation={[0, -0.25, 0]}>
        <boxGeometry args={[0.13, 0.06, 0.24]} />
        {black}
      </mesh>
      <mesh position={[-0.03, -0.09, ARM_LENGTH - 0.02]}>
        <boxGeometry args={[0.06, 0.05, 0.08]} />
        {brass}
      </mesh>
    </group>

    {/* Arranque, 33/45 y piloto ámbar en la esquina delantera */}
    <mesh position={[-1.38, TOP + 0.03, 0.98]}>
      <cylinderGeometry args={[0.13, 0.13, 0.05, 32]} />
      {aluminium}
    </mesh>
    {[0.98, 0.7].map((x, i) => <mesh key={x} position={[x, TOP + 0.02, 0.98]}>
      <boxGeometry args={[0.2, 0.04, 0.12]} />
      {i ? black : aluminium}
    </mesh>)}
    <mesh position={[-1.06, TOP + 0.03, 0.98]}>
      <sphereGeometry args={[0.04, 16, 16]} />
      <meshStandardMaterial ref={pilot} color="#ffb060" emissive="#ff8a2a" emissiveIntensity={0.15} roughness={0.3} />
    </mesh>
  </group>;
}
