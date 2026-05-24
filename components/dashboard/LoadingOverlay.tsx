"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useItemPrices } from "@/lib/api/queries";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Full-screen splash shown on first load until the live snapshot arrives, so
 * the terminal never flashes empty panels. Fades out once prices are in (and
 * is effectively instant on subsequent navigations thanks to the query cache).
 */
export function LoadingOverlay() {
  const { data } = useItemPrices();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setDone(true), 350);
    return () => clearTimeout(t);
  }, [data]);

  if (done) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-bg transition-opacity duration-300 ${
        data ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <Image
        src="/logo.webp"
        alt="WarEra Pulse"
        width={408}
        height={160}
        priority
        className="h-[80px] w-auto"
      />
      <Spinner className="h-7 w-7" />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
        Connecting to the WarEra gateway…
      </span>
    </div>
  );
}
