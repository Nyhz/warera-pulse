import { create } from "zustand";

/**
 * In-memory session price history, accumulated from each snapshot poll.
 * The WarEra gateway has no price-history endpoint, so the line chart and rail
 * sparklines are built from prices we observe live while the app is open.
 * Resets on reload (a persistent history would need server-side storage).
 */
export type Point = { t: number; v: number };

/** Max points kept per item (~8h at one point / 15s). */
const CAP = 2000;

type HistoryState = {
  series: Record<string, Point[]>;
  push: (prices: Record<string, number>) => void;
};

export const useHistory = create<HistoryState>((set) => ({
  series: {},
  push: (prices) =>
    set((state) => {
      const t = Math.floor(Date.now() / 1000);
      const next: Record<string, Point[]> = { ...state.series };
      for (const [code, v] of Object.entries(prices)) {
        if (!Number.isFinite(v)) continue;
        const arr = next[code] ?? [];
        const last = arr[arr.length - 1];
        // lightweight-charts needs strictly-ascending, unique-second times.
        if (last && last.t >= t) continue;
        const appended = [...arr, { t, v }];
        next[code] = appended.length > CAP ? appended.slice(-CAP) : appended;
      }
      return { series: next };
    }),
}));
