/**
 * Rifle profile state store
 * Manages rifle profiles in memory for quick access
 */

import { create } from 'zustand';
import { RifleProfile, RifleProfileData } from '../models/RifleProfile';
import { rifleProfileRepository } from '../services/database/RifleProfileRepository';

interface RifleState {
  // Rifle profiles
  rifles: RifleProfile[];
  setRifles: (rifles: RifleProfile[]) => void;
  addRifle: (rifle: RifleProfile) => void;
  updateRifleInStore: (rifle: RifleProfile) => void;
  removeRifle: (id: number) => void;
  getRifleById: (id: number) => RifleProfile | undefined;

  // Database operations
  loadRifles: () => Promise<void>;
  createRifle: (data: RifleProfileData) => Promise<RifleProfile>;
  updateRifle: (id: number, data: RifleProfileData) => Promise<RifleProfile>;
  deleteRifle: (id: number) => Promise<void>;

  // Selected rifle
  selectedRifleId: number | null;
  setSelectedRifleId: (id: number | null) => void;

  // Loading state
  loading: boolean;
  setLoading: (value: boolean) => void;
}

export const useRifleStore = create<RifleState>((set, get) => ({
  rifles: [],
  setRifles: (rifles) => set({ rifles }),
  addRifle: (rifle) =>
    set((state) => ({
      rifles: [...state.rifles, rifle],
    })),
  updateRifleInStore: (rifle) =>
    set((state) => ({
      rifles: state.rifles.map((r) => (r.id === rifle.id ? rifle : r)),
    })),
  removeRifle: (id) =>
    set((state) => ({
      rifles: state.rifles.filter((r) => r.id !== id),
    })),
  getRifleById: (id) => get().rifles.find((r) => r.id === id),

  // Database operations
  loadRifles: async () => {
    set({ loading: true });
    try {
      const rifles = await rifleProfileRepository.getAll();
      set({ rifles, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  createRifle: async (data: RifleProfileData) => {
    const rifle = new RifleProfile(data);
    const createdRifle = await rifleProfileRepository.create(rifle);
    get().addRifle(createdRifle);
    return createdRifle;
  },

  updateRifle: async (id: number, data: RifleProfileData) => {
    const rifle = new RifleProfile({ ...data, id });
    const updatedRifle = await rifleProfileRepository.update(id, rifle);
    if (!updatedRifle) {
      throw new Error(`Rifle profile with id ${id} not found`);
    }
    get().updateRifleInStore(updatedRifle);
    return updatedRifle;
  },

  deleteRifle: async (id: number) => {
    await rifleProfileRepository.delete(id);
    get().removeRifle(id);
  },

  selectedRifleId: null,
  setSelectedRifleId: (id) => set({ selectedRifleId: id }),

  loading: false,
  setLoading: (value) => set({ loading: value }),
}));
