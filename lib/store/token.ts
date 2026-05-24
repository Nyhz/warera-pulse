import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The user's own WarEra session token (JWT), kept only in this browser
 * (localStorage). Used to unlock the auth-gated equipment-offers endpoint —
 * the market data it returns is global (same for everyone), so the server
 * caches it; the token only authorizes the upstream call.
 */
type TokenState = {
  token: string | null;
  setToken: (t: string | null) => void;
};

export const useToken = create<TokenState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token: token && token.trim() ? token.trim() : null }),
    }),
    { name: "wr-jwt" },
  ),
);
