/**
 * Rifle profile state store
 * Manages rifle profiles in memory for quick access
 */

import { create } from 'zustand';
import type { RifleProfile } from '../models/RifleProfile';

interface RifleState {
  // Rifle profiles
  rifles: RifleProfile[];
  setRifles: (rifles: RifleProfile[]) => void;
  addRifle: (rifle: RifleProfile) => void;
  updateRifle: (rifle: RifleProfile) => void;
  removeRifle: (id: number) => void;
  getRifleById: (id: number) => RifleProfile | undefined;

  // Selected rifle
  selectedRifleId: number | null;
  setSelectedRifleId: (id: number | null) => void;

  // Loading state
  isLoading: boolean;
  setLoading: (value: boolean) => void;
}

export const useRifleStore = create<RifleState>((set, get) => ({
  rifles: [],
  setRifles: (rifles) => set({ rifles }),
  addRifle: (rifle) =>
    set((state) => ({
      rifles: [...state.rifles, rifle],
    })),
  updateRifle: (rifle) =>
    set((state) => ({
      rifles: state.rifles.map((r) => (r.id === rifle.id ? rifle : r)),
    })),
  removeRifle: (id) =>
    set((state) => ({
      rifles: state.rifles.filter((r) => r.id !== id),
    })),
  getRifleById: (id) => get().rifles.find((r) => r.id === id),

  selectedRifleId: null,
  setSelectedRifleId: (id) => set({ selectedRifleId: id }),

  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
}));
