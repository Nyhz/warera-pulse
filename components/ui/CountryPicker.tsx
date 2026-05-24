"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag } from "./Flag";
import type { Country } from "@/lib/api/schemas";

/** One option row in the dropdown. Module-scope so it isn't recreated per render. */
function PickerRow({
  id,
  label,
  code,
  active,
  onSelect,
}: {
  id: string;
  label: string;
  code?: string;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition-colors hover:bg-[#0e1420] ${
        active ? "bg-[#0f1826] text-txt" : "text-dim"
      }`}
    >
      {code ? <Flag code={code} className="!h-2.5 !w-[14px]" /> : <span className="w-[14px]" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Country filter dropdown with real flags. A native <select> can't render flag
 * sprites (and emoji flags don't show on Windows), so this is a small custom
 * combobox portalled to <body> to escape the panel's overflow clipping.
 */
export function CountryPicker({
  countries,
  value,
  onChange,
}: {
  countries: Country[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const sel = value ? countries.find((c) => c._id === value) : null;
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? countries.filter((c) => c.name.toLowerCase().includes(term)) : countries;
  }, [countries, q]);

  useEffect(() => {
    if (!open) return;
    setRect(btnRef.current?.getBoundingClientRect() ?? null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  const onSelect = (id: string) => {
    onChange(id);
    close();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Filter the feed by country"
        className="flex w-[150px] items-center gap-1.5 rounded-[3px] border border-line bg-panel2 px-2 py-1 text-[10.5px] text-txt transition-colors hover:border-dim"
      >
        {sel ? <Flag code={sel.code.toUpperCase()} className="!h-2.5 !w-[14px]" /> : null}
        <span className="truncate">{sel ? sel.name : "All countries"}</span>
        <span className="ml-auto text-faint">▾</span>
      </button>

      {open && rect
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[60]" onClick={close} />
              <div
                style={{ top: rect.bottom + 4, left: Math.max(8, rect.right - 210) }}
                className="fixed z-[61] w-[210px] overflow-hidden rounded-[4px] border border-line bg-panel2 shadow-xl"
              >
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search country…"
                  className="w-full border-b border-line bg-panel px-2.5 py-2 text-[11px] text-txt outline-none"
                />
                <div className="max-h-[280px] overflow-y-auto">
                  <PickerRow id="" label="All countries" active={value === ""} onSelect={onSelect} />
                  {filtered.map((c) => (
                    <PickerRow
                      key={c._id}
                      id={c._id}
                      label={c.name}
                      code={c.code.toUpperCase()}
                      active={c._id === value}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
