'use client';

import { useEffect, useRef } from 'react';

export function ScrollSpy() {
  const isScrollingToTarget = useRef(false);

  useEffect(() => {
    // Scroll to the target element on mount if it matches the current pathname
    const currentPath = window.location.pathname;
    const targetEl = document.querySelector(`[data-url="${currentPath}"]`);
    if (targetEl) {
      isScrollingToTarget.current = true;
      targetEl.scrollIntoView();
      setTimeout(() => {
        isScrollingToTarget.current = false;
      }, 1000);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToTarget.current) return;
        
        // Find the top-most visible element that takes up a reasonable portion of the screen
        let visibleEntry = null;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
            visibleEntry = entry;
            break; // take the first one since intersection observer usually orders them
          }
        }
        
        if (visibleEntry) {
          const url = visibleEntry.target.getAttribute('data-url');
          if (url && window.location.pathname !== url) {
            window.history.replaceState(null, '', url);
          }
        }
      },
      {
        rootMargin: '-20% 0px -40% 0px',
        threshold: [0.1, 0.5, 0.9],
      }
    );

    const elements = document.querySelectorAll('.section-page');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return null;
}
