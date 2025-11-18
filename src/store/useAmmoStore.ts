/**
 * Ammunition profile state store
 * Manages ammo profiles in memory for quick access
 */

import { create } from 'zustand';
import { AmmoProfile, AmmoProfileData } from '../models/AmmoProfile';
import { ammoProfileRepository } from '../services/database/AmmoProfileRepository';

interface AmmoState {
  // Ammo profiles
  ammoProfiles: AmmoProfile[];
  setAmmoProfiles: (profiles: AmmoProfile[]) => void;
  addAmmoProfileToStore: (profile: AmmoProfile) => void;
  updateAmmoProfileInStore: (profile: AmmoProfile) => void;
  removeAmmoProfileFromStore: (id: number) => void;
  getAmmoById: (id: number) => AmmoProfile | undefined;
  getAmmoByRifleId: (rifleId: number) => AmmoProfile[];

  // Database operations
  loadAmmoProfiles: (rifleId?: number) => Promise<void>;
  createAmmoProfile: (data: AmmoProfileData) => Promise<AmmoProfile>;
  updateAmmoProfile: (id: number, data: AmmoProfileData) => Promise<AmmoProfile>;
  deleteAmmoProfile: (id: number) => Promise<void>;

  // Selected ammo
  selectedAmmoId: number | null;
  setSelectedAmmoId: (id: number | null) => void;

  // Loading state
  loading: boolean;
  setLoading: (value: boolean) => void;
}

export const useAmmoStore = create<AmmoState>((set, get) => ({
  ammoProfiles: [],
  setAmmoProfiles: (profiles) => set({ ammoProfiles: profiles }),
  addAmmoProfileToStore: (profile) =>
    set((state) => ({
      ammoProfiles: [...state.ammoProfiles, profile],
    })),
  updateAmmoProfileInStore: (profile) =>
    set((state) => ({
      ammoProfiles: state.ammoProfiles.map((a) => (a.id === profile.id ? profile : a)),
    })),
  removeAmmoProfileFromStore: (id) =>
    set((state) => ({
      ammoProfiles: state.ammoProfiles.filter((a) => a.id !== id),
    })),
  getAmmoById: (id) => get().ammoProfiles.find((a) => a.id === id),
  getAmmoByRifleId: (rifleId) => get().ammoProfiles.filter((a) => a.rifleId === rifleId),

  // Database operations
  loadAmmoProfiles: async (rifleId?: number) => {
    set({ loading: true });
    try {
      const profiles = rifleId
        ? await ammoProfileRepository.getByRifleId(rifleId)
        : await ammoProfileRepository.getAll();
      set({ ammoProfiles: profiles, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  createAmmoProfile: async (data: AmmoProfileData) => {
    const profile = new AmmoProfile(data);
    const createdProfile = await ammoProfileRepository.create(profile);
    get().addAmmoProfileToStore(createdProfile);
    return createdProfile;
  },

  updateAmmoProfile: async (id: number, data: AmmoProfileData) => {
    const profile = new AmmoProfile({ ...data, id });
    const updatedProfile = await ammoProfileRepository.update(id, profile);
    if (!updatedProfile) {
      throw new Error(`Ammo profile with id ${id} not found`);
    }
    get().updateAmmoProfileInStore(updatedProfile);
    return updatedProfile;
  },

  deleteAmmoProfile: async (id: number) => {
    await ammoProfileRepository.delete(id);
    get().removeAmmoProfileFromStore(id);
  },

  selectedAmmoId: null,
  setSelectedAmmoId: (id) => set({ selectedAmmoId: id }),

  loading: false,
  setLoading: (value) => set({ loading: value }),
}));
