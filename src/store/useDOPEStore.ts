/**
 * DOPE log state store
 * Manages DOPE logs in memory for quick access
 */

import { create } from 'zustand';
import { DOPELog, DOPELogData } from '../models/DOPELog';
import { dopeLogRepository } from '../services/database/DOPELogRepository';

interface DOPEState {
  // DOPE logs
  dopeLogs: DOPELog[];
  setDopeLogs: (logs: DOPELog[]) => void;
  addDopeLogToStore: (log: DOPELog) => void;
  updateDopeLogInStore: (log: DOPELog) => void;
  removeDopeLogFromStore: (id: number) => void;
  getDopeById: (id: number) => DOPELog | undefined;
  getDopeByRifleAndAmmo: (rifleId: number, ammoId: number) => DOPELog[];

  // Database operations
  loadDopeLogs: (rifleId?: number, ammoId?: number) => Promise<void>;
  createDopeLog: (data: DOPELogData) => Promise<DOPELog>;
  updateDopeLog: (id: number, data: Partial<DOPELogData>) => Promise<DOPELog>;
  deleteDopeLog: (id: number) => Promise<void>;

  // Loading state
  loading: boolean;
  setLoading: (value: boolean) => void;
}

export const useDOPEStore = create<DOPEState>((set, get) => ({
  dopeLogs: [],
  setDopeLogs: (logs) => set({ dopeLogs: logs }),
  addDopeLogToStore: (log) =>
    set((state) => ({
      dopeLogs: [...state.dopeLogs, log],
    })),
  updateDopeLogInStore: (log) =>
    set((state) => ({
      dopeLogs: state.dopeLogs.map((d) => (d.id === log.id ? log : d)),
    })),
  removeDopeLogFromStore: (id) =>
    set((state) => ({
      dopeLogs: state.dopeLogs.filter((d) => d.id !== id),
    })),
  getDopeById: (id) => get().dopeLogs.find((d) => d.id === id),
  getDopeByRifleAndAmmo: (rifleId, ammoId) =>
    get().dopeLogs.filter((d) => d.rifleId === rifleId && d.ammoId === ammoId),

  // Database operations
  loadDopeLogs: async (rifleId?: number, ammoId?: number) => {
    set({ loading: true });
    try {
      let logs: DOPELog[];
      if (rifleId && ammoId) {
        logs = await dopeLogRepository.getByRifleAndAmmo(rifleId, ammoId);
      } else if (rifleId) {
        logs = await dopeLogRepository.getByRifleId(rifleId);
      } else {
        logs = await dopeLogRepository.getAll();
      }
      set({ dopeLogs: logs, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  createDopeLog: async (data: DOPELogData) => {
    const log = await dopeLogRepository.create(data);
    get().addDopeLogToStore(log);
    return log;
  },

  updateDopeLog: async (id: number, data: Partial<DOPELogData>) => {
    const log = await dopeLogRepository.update(id, data);
    if (!log) {
      throw new Error(`DOPE log with id ${id} not found`);
    }
    get().updateDopeLogInStore(log);
    return log;
  },

  deleteDopeLog: async (id: number) => {
    await dopeLogRepository.delete(id);
    get().removeDopeLogFromStore(id);
  },

  loading: false,
  setLoading: (value) => set({ loading: value }),
}));
