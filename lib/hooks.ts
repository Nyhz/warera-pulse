"use client";

import { useEffect, useState } from "react";

/**
 * True below the given width. Defaults to false (desktop) for SSR, then syncs
 * on mount — used to switch list panels from inner-scroll (desktop) to a
 * limit + "load more" (mobile), so they don't trap the natural page scroll.
 */
export function useIsMobile(maxWidth = 767): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);
  return mobile;
}
