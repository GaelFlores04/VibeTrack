import { Component, lazy, Suspense, useState } from 'react';
import Disc from '../../shared/components/Disc';

// La escena 3D (three.js + React Three Fiber) se descarga sólo en esta página (D10).
const PlayerScene = lazy(() => import('./scene/PlayerScene'));

function hasWebGL() {
  try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl'))); }
  catch { return false; }
}

class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

// Respaldo estático (D10/D12): el mismo reproductor dibujado, con el CD elegido dentro.
function StaticPlayer({ selected, playing }) {
  return <div className="static-player" aria-hidden="true">
    <div className="static-body">
      <div className={`static-disc${playing ? ' is-spinning' : ''}`}><Disc track={selected} size={220} /></div>
      <div className="static-lid" />
    </div>
  </div>;
}

// lcd: la pantalla HTML (D09) se acopla al frente del reproductor que la escena proyecta en pantalla.
const STATIC_ANCHOR = { x: 0.59, y: 0.8 };
export default function PlayerStage({ tracks, selected, playing, reduced, onPick, label, lcd }) {
  const [failed, setFailed] = useState(() => !hasWebGL());
  const [anchor, setAnchor] = useState(null);
  const dock = failed || !anchor ? STATIC_ANCHOR : anchor;
  // La escena es una imagen descrita; la LCD queda fuera de ella para seguir siendo texto accesible.
  return <div className="stage">
    <div className="stage-scene" role="img" aria-label={label}>
    {failed || !selected
      ? <StaticPlayer selected={selected} playing={playing && !reduced} />
      : <SceneBoundary onError={() => setFailed(true)}>
        <Suspense fallback={<div className="stage-loading"><StaticPlayer selected={selected} playing={false} /><p>Preparando el reproductor…</p></div>}>
          <PlayerScene tracks={tracks} selectedId={selected.id} playing={playing} reduced={reduced} onPick={onPick} onSlow={() => setFailed(true)} onAnchor={setAnchor} />
        </Suspense>
      </SceneBoundary>}
    </div>
    {lcd && <div className="lcd-dock" style={{ left: `clamp(var(--half), ${dock.x * 100}%, calc(100% - var(--half)))`, top: `${dock.y * 100}%` }}>{lcd}</div>}
    {failed && <p className="stage-note">Vista simple del reproductor</p>}
  </div>;
}
