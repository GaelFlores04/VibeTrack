import { useLayoutEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function PageTransition({ pageKey, children }) {
  const element = useRef(null);
  const reduced = useReducedMotion();
  const previousPage = useRef(pageKey);

  useLayoutEffect(() => {
    const returning = pageKey === '/' || (previousPage.current.startsWith('/recomendaciones/') && pageKey === '/moods');
    previousPage.current = pageKey;
    if (reduced || document.documentElement.dataset.input === 'keyboard') return;
    const page = element.current;
    if (!page?.animate) return;
    const animation = page.animate(
      reduced
        ? [{ opacity: .8 }, { opacity: 1 }]
        : [{ opacity: .75, transform: `translateX(${returning ? -12 : 12}px)` }, { opacity: 1, transform: 'translateX(0)' }],
      { duration: reduced ? 120 : 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
    return () => animation.cancel();
  }, [pageKey, reduced]);

  return <div ref={element} className="page-content">{children}</div>;
}
