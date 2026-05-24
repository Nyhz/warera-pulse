"use client";

import { useState } from "react";
import { useToken } from "@/lib/store/token";

/**
 * BYOT: lets the user paste their own WarEra session token (JWT) to unlock
 * equipment market prices. Stored only in this browser (localStorage).
 */
export function TokenButton() {
  const token = useToken((s) => s.token);
  const setToken = useToken((s) => s.setToken);
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const connected = !!token;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Connect your WarEra token to load equipment prices"
        className="flex items-center gap-1.5 rounded-[3px] border border-line px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-dim transition-colors hover:text-txt"
      >
        <span className={`h-[7px] w-[7px] rounded-full ${connected ? "bg-up" : "bg-faint"}`} />
        {connected ? "Token" : "Connect"}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[300px] rounded-[4px] border border-line bg-panel p-3 shadow-2xl">
            <p className="mb-2 text-[10.5px] leading-[1.5] text-dim">
              Paste your WarEra session token (JWT) to load live equipment prices. Kept only in this
              browser; sent to the gateway to read the public market — never saved on our server.
            </p>
            <input
              type="password"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="eyJhbGciOi…"
              className="w-full rounded-[3px] border border-line bg-panel2 px-2 py-1.5 font-mono text-[11px] text-txt outline-none focus:border-accent"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setToken(val || null);
                  setVal("");
                  setOpen(false);
                }}
                className="flex-1 rounded-[3px] border border-accent bg-accent py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#06210d]"
              >
                Save
              </button>
              {connected ? (
                <button
                  type="button"
                  onClick={() => {
                    setToken(null);
                    setVal("");
                  }}
                  className="rounded-[3px] border border-line px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-down"
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
