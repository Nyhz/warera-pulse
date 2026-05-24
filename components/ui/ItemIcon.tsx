"use client";

import { useState } from "react";

/** File extension for the self-hosted item icons in /public/items. */
const ICON_EXT = "webp";

/**
 * Resource icon from /public/items/{code}.{ext}. Renders nothing if the file is
 * missing, so names stay intact whether or not the icons have been added yet.
 */
export function ItemIcon({ code, className = "" }: { code: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/items/${code}.${ICON_EXT}`}
      alt=""
      aria-hidden
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
