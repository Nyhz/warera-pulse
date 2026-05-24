import { create } from "zustand";

type UIState = {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
};

export const useUIStore = create<UIState>((set) => ({
  selectedSymbol: "iron",
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
}));
