import { useEffect, useState } from 'react';
const query = '(prefers-reduced-motion: reduce)';
// D11: sigue la preferencia del sistema en vivo (sin giro continuo y cambios de disco inmediatos).
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}
