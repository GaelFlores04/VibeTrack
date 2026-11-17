import { useEffect, useRef } from 'react';
import Disc from './Disc';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Una sola animación por miniatura: play/pause conserva el ángulo durante las pausas.
export default function PlaybackDisc({ track, size = 48, playing = false, className = '' }) {
  const disc = useRef(null);
  const motion = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced || !disc.current?.animate) return;
    const animation = disc.current.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 6000, iterations: Infinity, easing: 'linear' },
    );
    animation.pause();
    motion.current = animation;
    return () => { animation.cancel(); motion.current = null; };
  }, [reduced]);

  useEffect(() => {
    const sync = () => {
      if (playing && document.visibilityState !== 'hidden') motion.current?.play();
      else motion.current?.pause();
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [playing, reduced]);

  return (
    <span ref={disc} className={`playback-disc ${className}`.trim()} style={{ '--size': `${size}px` }} aria-hidden="true">
      <Disc track={track} size={size} />
    </span>
  );
}
