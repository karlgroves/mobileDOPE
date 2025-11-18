/**
 * DOPE log state store
 * Manages DOPE logs in memory for quick access
 */

import { create } from 'zustand';
import type { DOPELog } from '../models/DOPELog';

interface DOPEState {
  // DOPE logs
  dopeLogs: DOPELog[];
  setDopeLogs: (logs: DOPELog[]) => void;
  addDopeLog: (log: DOPELog) => void;
  updateDopeLog: (log: DOPELog) => void;
  removeDopeLog: (id: number) => void;
  getDopeById: (id: number) => DOPELog | undefined;
  getDopeByRifleAndAmmo: (rifleId: number, ammoId: number) => DOPELog[];

  // Loading state
  isLoading: boolean;
  setLoading: (value: boolean) => void;
}

export const useDOPEStore = create<DOPEState>((set, get) => ({
  dopeLogs: [],
  setDopeLogs: (logs) => set({ dopeLogs: logs }),
  addDopeLog: (log) =>
    set((state) => ({
      dopeLogs: [...state.dopeLogs, log],
    })),
  updateDopeLog: (log) =>
    set((state) => ({
      dopeLogs: state.dopeLogs.map((d) => (d.id === log.id ? log : d)),
    })),
  removeDopeLog: (id) =>
    set((state) => ({
      dopeLogs: state.dopeLogs.filter((d) => d.id !== id),
    })),
  getDopeById: (id) => get().dopeLogs.find((d) => d.id === id),
  getDopeByRifleAndAmmo: (rifleId, ammoId) =>
    get().dopeLogs.filter((d) => d.rifleId === rifleId && d.ammoId === ammoId),

  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
}));
