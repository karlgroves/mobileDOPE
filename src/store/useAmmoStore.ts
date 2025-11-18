/**
 * Ammunition profile state store
 * Manages ammo profiles in memory for quick access
 */

import { create } from 'zustand';
import type { AmmoProfile } from '../models/AmmoProfile';

interface AmmoState {
  // Ammo profiles
  ammoProfiles: AmmoProfile[];
  setAmmoProfiles: (profiles: AmmoProfile[]) => void;
  addAmmoProfile: (profile: AmmoProfile) => void;
  updateAmmoProfile: (profile: AmmoProfile) => void;
  removeAmmoProfile: (id: number) => void;
  getAmmoById: (id: number) => AmmoProfile | undefined;
  getAmmoByRifleId: (rifleId: number) => AmmoProfile[];

  // Selected ammo
  selectedAmmoId: number | null;
  setSelectedAmmoId: (id: number | null) => void;

  // Loading state
  isLoading: boolean;
  setLoading: (value: boolean) => void;
}

export const useAmmoStore = create<AmmoState>((set, get) => ({
  ammoProfiles: [],
  setAmmoProfiles: (profiles) => set({ ammoProfiles: profiles }),
  addAmmoProfile: (profile) =>
    set((state) => ({
      ammoProfiles: [...state.ammoProfiles, profile],
    })),
  updateAmmoProfile: (profile) =>
    set((state) => ({
      ammoProfiles: state.ammoProfiles.map((a) => (a.id === profile.id ? profile : a)),
    })),
  removeAmmoProfile: (id) =>
    set((state) => ({
      ammoProfiles: state.ammoProfiles.filter((a) => a.id !== id),
    })),
  getAmmoById: (id) => get().ammoProfiles.find((a) => a.id === id),
  getAmmoByRifleId: (rifleId) => get().ammoProfiles.filter((a) => a.rifleId === rifleId),

  selectedAmmoId: null,
  setSelectedAmmoId: (id) => set({ selectedAmmoId: id }),

  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
}));
