import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, DoubleSide, ExtrudeGeometry, RepeatWrapping, Shape } from 'three';

// Reproductor portátil ovalado (D02), modelado en código: dos carcasas plateadas con línea de unión,
// tapa de acrílico azul abombada con bisagra y pestaña, pozo con eje y ventana del láser,
// botonera frontal, interruptor HOLD y conectores laterales. Arriba del todo queda la cara de la tapa
// en y ≈ 0.29; el CD se apoya sobre el pozo (y ≈ 0.258).
const RX = 1.26;          // semiejes del óvalo antes del bisel
const RZ = 1.1;
const BEVEL = 0.07;
const DEPTH = 0.22;
const TOP = 0.24;         // cara superior del cuerpo
const LID_RADIUS = 1.0;
const LID_DOME = 0.05;
const LID_OPEN = -0.98;
const SIDE_Y = TOP - 0.13;    // altura de marco y conectores en el canto, por encima de la unión

const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
const step = dt => Math.min(dt, 1 / 30);

function ovalShape(rx, rz) {
  const shape = new Shape();
  shape.absellipse(0, 0, rx, rz, 0, Math.PI * 2, false, 0);
  return shape;
}

// Aluminio cepillado en círculos: mapa de rugosidad sutil para la cara superior.
function brushedTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgb(118,118,118)';
  ctx.fillRect(0, 0, size, size);
  for (let r = 2; r < size * 0.72; r += 1.5) {
    const tone = 100 + Math.floor(Math.random() * 46);
    ctx.strokeStyle = `rgba(${tone},${tone},${tone},.55)`;
    ctx.lineWidth = Math.random() * 1.2 + 0.3;
    ctx.beginPath(); ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2); ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  // Las UV de la extrusión son coordenadas del óvalo (-1.3…1.3): se centran y escalan.
  texture.repeat.set(1 / 2.8, 1 / 2.8);
  texture.offset.set(0.5, 0.5);
  return texture;
}

function softShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0, 6, 20, .7)');
  gradient.addColorStop(1, 'rgba(0, 6, 20, 0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new CanvasTexture(canvas);
}

export default function DiscmanModel({ position, motion }) {
  const lid = useRef();
  const angle = useRef(0);
  const assets = useMemo(() => {
    const body = new ExtrudeGeometry(ovalShape(RX, RZ), { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 10, curveSegments: 96 });
    body.rotateX(-Math.PI / 2);
    body.translate(0, TOP - DEPTH - BEVEL, 0);
    // Línea de unión entre las dos carcasas, a media altura del canto.
    const seam = new ExtrudeGeometry(ovalShape(RX + BEVEL + 0.004, RZ + BEVEL + 0.004), { depth: 0.012, bevelEnabled: false, curveSegments: 96 });
    seam.rotateX(-Math.PI / 2);
    seam.translate(0, TOP - BEVEL - DEPTH * 0.78, 0);
    // Cúpula baja de la tapa: casquete de una esfera grande.
    const sphereRadius = (LID_RADIUS ** 2 + LID_DOME ** 2) / (2 * LID_DOME);
    return { body, seam, brushed: brushedTexture(), shadow: softShadowTexture(), sphereRadius, theta: Math.asin(LID_RADIUS / sphereRadius) };
  }, []);

  useFrame((state, raw) => {
    const dt = step(raw);
    const open = state.clock.elapsedTime < motion.current.lidUntil;
    const target = open ? LID_OPEN : 0;
    angle.current += (target - angle.current) * (motion.current.reduced ? 1 : damp(dt, open ? 10 : 7));
    if (lid.current) lid.current.rotation.x = angle.current;
    // Abierta, sigue pidiendo fotogramas hasta que vence su plazo y se cierra.
    if (open || Math.abs(target - angle.current) > 0.002) state.invalidate();
  });

  const silver = <meshPhysicalMaterial color="#c9d1db" metalness={0.86} roughness={0.34} roughnessMap={assets.brushed} clearcoat={0.25} clearcoatRoughness={0.4} />;
  const trim = <meshStandardMaterial color="#e3e9ef" metalness={0.92} roughness={0.18} />;
  const dark = <meshStandardMaterial color="#1b2430" metalness={0.3} roughness={0.55} />;
  const sideX = RX + BEVEL;

  return <group position={position}>
    <mesh position={[0, -0.13, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.5, 3.1]} />
      <meshBasicMaterial map={assets.shadow} transparent depthWrite={false} />
    </mesh>

    {/* Carcasa y línea de unión */}
    <mesh geometry={assets.body}>{silver}</mesh>
    <mesh geometry={assets.seam}><meshStandardMaterial color="#56616f" metalness={0.5} roughness={0.5} /></mesh>

    {/* Pozo del CD: fondo, anillos, ventana del láser y eje con pestañas */}
    <mesh position={[0, TOP + 0.0015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.95, 96]} />
      <meshStandardMaterial color="#5f6b7a" metalness={0.55} roughness={0.5} />
    </mesh>
    <mesh position={[0, TOP + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.93, 0.95, 96]} />
      <meshStandardMaterial color="#8d99a8" metalness={0.8} roughness={0.3} />
    </mesh>
    <mesh position={[0, TOP + 0.004, 0.52]}>
      <boxGeometry args={[0.3, 0.006, 0.12]} />
      <meshStandardMaterial color="#0b0f16" metalness={0.2} roughness={0.15} />
    </mesh>
    <mesh position={[0.05, TOP + 0.009, 0.52]}>
      <cylinderGeometry args={[0.025, 0.025, 0.008, 24]} />
      <meshStandardMaterial color="#6fa8ff" emissive="#284f9a" emissiveIntensity={0.6} metalness={0.2} roughness={0.1} />
    </mesh>
    <mesh position={[0, TOP + 0.018, 0]}>
      <cylinderGeometry args={[0.1, 0.11, 0.035, 40]} />
      {trim}
    </mesh>
    {[0, 2.094, 4.189].map(a => <mesh key={a} position={[Math.cos(a) * 0.075, TOP + 0.038, Math.sin(a) * 0.075]}>
      <sphereGeometry args={[0.014, 12, 12]} />
      {trim}
    </mesh>)}

    {/* Bisel plateado alrededor de la tapa */}
    <mesh position={[0, TOP + 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.03, 0.022, 12, 120]} />
      {trim}
    </mesh>

    {/* Bisagra trasera */}
    <mesh position={[0, TOP + 0.03, -1.0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.035, 0.035, 0.56, 24]} />
      {trim}
    </mesh>

    {/* Tapa: gira sobre la bisagra; cúpula translúcida, aro y pestaña de apertura */}
    <group ref={lid} position={[0, TOP + 0.045, -0.98]}>
      <group position={[0, 0, 0.98]}>
        <mesh position={[0, -(assets.sphereRadius - LID_DOME), 0]}>
          <sphereGeometry args={[assets.sphereRadius, 96, 8, 0, Math.PI * 2, 0, assets.theta]} />
          <meshPhysicalMaterial color="#2f8dff" transparent opacity={0.26} roughness={0.1} metalness={0} clearcoat={0.15} clearcoatRoughness={0.3} envMapIntensity={0.25} side={DoubleSide} depthWrite={false} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[LID_RADIUS, 0.02, 10, 120]} />
          <meshPhysicalMaterial color="#9fd6ff" transparent opacity={0.75} roughness={0.2} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, LID_RADIUS + 0.03]}>
          <boxGeometry args={[0.16, 0.022, 0.06]} />
          {trim}
        </mesh>
      </group>
    </group>

    {/* Botonera frontal: cuatro teclas discretas en el arco delantero */}
    {[-0.42, -0.14, 0.14, 0.42].map((x, i) => <mesh key={x} position={[x, TOP + 0.012, 1.075 - Math.abs(x) * 0.12]} rotation={[0, (x * -0.35), Math.PI / 2]}>
      <capsuleGeometry args={[0.022, 0.09, 6, 16]} />
      {i === 2 ? <meshStandardMaterial color="#8fdcff" metalness={0.6} roughness={0.25} /> : trim}
    </mesh>)}

    {/* Marco de la pantalla en el canto frontal (la LCD de HTML se acopla aquí) */}
    <mesh position={[0, SIDE_Y, RZ + BEVEL - 0.005]}>
      <boxGeometry args={[0.86, 0.15, 0.02]} />
      {dark}
    </mesh>

    {/* Laterales: interruptor HOLD a la izquierda; salida de audio y entrada de corriente a la derecha */}
    <mesh position={[-sideX + 0.005, SIDE_Y, 0]} rotation={[0, Math.PI / 2, 0]}>
      <boxGeometry args={[0.2, 0.05, 0.02]} />
      {dark}
    </mesh>
    <mesh position={[-sideX - 0.004, SIDE_Y, 0.04]} rotation={[0, Math.PI / 2, 0]}>
      <boxGeometry args={[0.06, 0.04, 0.02]} />
      <meshStandardMaterial color="#ffb48a" metalness={0.3} roughness={0.4} />
    </mesh>
    {[-0.12, 0.14].map((z, i) => <mesh key={z} position={[sideX - 0.004, SIDE_Y, z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[i ? 0.04 : 0.032, i ? 0.04 : 0.032, 0.02, 24]} />
      {dark}
    </mesh>)}
  </group>;
}
