/**
 * Environment snapshot state store
 * Manages current environmental conditions and snapshots
 */

import { create } from 'zustand';
import { EnvironmentSnapshot, EnvironmentSnapshotData } from '../models/EnvironmentSnapshot';
import { environmentRepository } from '../services/database/EnvironmentRepository';

interface EnvironmentState {
  // Current environment data (for active shooting session)
  current: EnvironmentSnapshotData | null;
  setCurrent: (data: EnvironmentSnapshotData | null) => void;
  updateCurrent: (data: Partial<EnvironmentSnapshotData>) => void;

  // Recent snapshots
  snapshots: EnvironmentSnapshot[];
  setSnapshots: (snapshots: EnvironmentSnapshot[]) => void;

  // Database operations
  loadSnapshots: (limit?: number) => Promise<void>;
  createSnapshot: (data: EnvironmentSnapshotData) => Promise<EnvironmentSnapshot>;
  updateSnapshot: (
    id: number,
    data: Partial<EnvironmentSnapshotData>
  ) => Promise<EnvironmentSnapshot>;
  deleteSnapshot: (id: number) => Promise<void>;
  loadCurrent: () => Promise<void>;
  saveCurrent: () => Promise<EnvironmentSnapshot>;

  // Loading state
  loading: boolean;
  setLoading: (value: boolean) => void;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  current: null,
  setCurrent: (data) => set({ current: data }),
  updateCurrent: (data) =>
    set((state) => ({
      current: state.current ? { ...state.current, ...data } : null,
    })),

  snapshots: [],
  setSnapshots: (snapshots) => set({ snapshots }),

  loadSnapshots: async (limit?: number) => {
    set({ loading: true });
    try {
      const snapshots = limit
        ? await environmentRepository.getRecent(limit)
        : await environmentRepository.getAll();
      set({ snapshots, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  createSnapshot: async (data: EnvironmentSnapshotData) => {
    const snapshot = await environmentRepository.create(data);
    set((state) => ({
      snapshots: [snapshot, ...state.snapshots],
    }));
    return snapshot;
  },

  updateSnapshot: async (id: number, data: Partial<EnvironmentSnapshotData>) => {
    const snapshot = await environmentRepository.update(id, data);
    if (!snapshot) {
      throw new Error(`Environment snapshot with id ${id} not found`);
    }
    set((state) => ({
      snapshots: state.snapshots.map((s) => (s.id === id ? snapshot : s)),
    }));
    return snapshot;
  },

  deleteSnapshot: async (id: number) => {
    await environmentRepository.delete(id);
    set((state) => ({
      snapshots: state.snapshots.filter((s) => s.id !== id),
    }));
  },

  loadCurrent: async () => {
    set({ loading: true });
    try {
      const current = await environmentRepository.getCurrent();
      set({ current: current?.toJSON() || null, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  saveCurrent: async () => {
    const { current } = get();
    if (!current) {
      throw new Error('No current environment data to save');
    }
    const snapshot = await environmentRepository.create(current);
    set((state) => ({
      snapshots: [snapshot, ...state.snapshots],
      current: snapshot.toJSON(),
    }));
    return snapshot;
  },

  loading: false,
  setLoading: (value) => set({ loading: value }),
}));
