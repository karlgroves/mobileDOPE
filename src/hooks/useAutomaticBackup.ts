import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { runAutomaticBackup } from '../services/AutomaticBackupService';
import { useAppStore } from '../store/useAppStore';
import { isBackupDue } from '../utils/backupSchedule';

/**
 * Writes an automatic backup when one is due (#66).
 *
 * There is no background-task module, so the moments a backup can happen are
 * the ones where the app is running anyway: as it finishes starting up, each
 * time it returns to the foreground, and straight after the shooter picks a
 * schedule in Settings -- so choosing "Daily" shows a first backup at once
 * rather than tomorrow.
 *
 * The time is recorded only after the file is written, so a failure (a full
 * disk, say) is retried at the next foreground instead of being skipped for a
 * day. Only one backup runs at a time: start-up and an AppState change can
 * arrive together.
 *
 * @param ready - Whether the database is open. Nothing happens until it is.
 */
export const useAutomaticBackup = (ready: boolean): void => {
  const running = useRef(false);
  const schedule = useAppStore((state) => state.settings.backupSchedule);

  useEffect(() => {
    if (!ready) return undefined;

    const backUpIfDue = async () => {
      const { settings, updateSettings } = useAppStore.getState();
      const now = new Date();
      if (running.current) return;
      if (!isBackupDue(settings.backupSchedule, settings.lastAutomaticBackupAt, now)) return;

      running.current = true;
      try {
        const result = await runAutomaticBackup(now);
        if (result.success) {
          await updateSettings({ lastAutomaticBackupAt: now.toISOString() });
        } else {
          console.error('Automatic backup failed:', result.error);
        }
      } finally {
        running.current = false;
      }
    };

    void backUpIfDue();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void backUpIfDue();
    });
    return () => subscription.remove();
  }, [ready, schedule]);
};
