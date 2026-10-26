/**
 * Automatic backup scheduling (#66).
 *
 * The app is offline-first and has no background-task module, and adding one
 * would mean a new native dependency and an OS permission for something the
 * shooter can live without. So "daily" here means "the first time the app is
 * opened or brought back to the foreground once a day has passed since the
 * last automatic backup", not "at 02:00 whether or not the app is running".
 * Someone who does not open the app for a fortnight has nothing new to back up
 * in that fortnight, so nothing is lost by waiting for them.
 *
 * This module is the pure half of that rule: whether a backup is due, what the
 * file is called, and which old files to delete. The file writing lives in
 * `ExportService.saveAutomaticBackup`, and the trigger in
 * `hooks/useAutomaticBackup`.
 */

/** How often an automatic backup is written. `manual` is the default and writes none. */
export type BackupSchedule = 'manual' | 'daily' | 'weekly';

const HOUR_MS = 3_600_000;

const INTERVAL_MS: Record<Exclude<BackupSchedule, 'manual'>, number> = {
  daily: 24 * HOUR_MS,
  weekly: 7 * 24 * HOUR_MS,
};

/**
 * How many automatic backups are kept on the device.
 *
 * Seven is a week of daily backups or seven weeks of weekly ones. The case it
 * exists for is a mistake noticed late -- a rifle deleted, or an import that
 * overwrote good records -- and a shooter tends to notice that at the next
 * range trip, which is days rather than hours away. One or two files would
 * already have been overwritten by the mistake by then. Each file is the JSON
 * text of the database, typically tens to a few hundred kilobytes, so seven
 * costs less storage than a single photo.
 */
export const AUTOMATIC_BACKUPS_KEPT = 7;

/**
 * Filename prefix for automatic backups. Distinct from the manual export's
 * `mobiledope_backup_` so pruning can never select a file the shooter wrote.
 */
const PREFIX = 'mobiledope_auto_';
const PATTERN = /^mobiledope_auto_(\d+)\.json$/;

/**
 * Whether an automatic backup should be written now.
 *
 * @param schedule - The shooter's chosen schedule.
 * @param lastBackupAt - ISO timestamp of the last automatic backup, if any.
 * @param now - The current time.
 */
export function isBackupDue(
  schedule: BackupSchedule,
  lastBackupAt: string | undefined,
  now: Date
): boolean {
  if (schedule === 'manual') return false;
  const last = lastBackupAt === undefined ? NaN : Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  const elapsed = now.getTime() - last;
  // A last run "in the future" means the clock has been set back since. Waiting
  // for the clock to catch up could skip backups for weeks; writing one now
  // resets the reference point instead.
  if (elapsed < 0) return true;
  return elapsed >= INTERVAL_MS[schedule];
}

/** Filename for an automatic backup written at `now`. */
export function automaticBackupFilename(now: Date): string {
  return `${PREFIX}${now.getTime()}.json`;
}

/** Automatic backups among `names`, newest first. Anything else is left out. */
function automaticBackupsNewestFirst(names: readonly string[]): string[] {
  return names
    .map((name) => ({ name, match: PATTERN.exec(name) }))
    .filter((entry): entry is { name: string; match: RegExpExecArray } => entry.match !== null)
    .sort((a, b) => Number(b.match[1]) - Number(a.match[1]))
    .map((entry) => entry.name);
}

/**
 * The automatic backups to delete so that only the newest `keep` remain.
 * Files that are not automatic backups are never selected.
 */
export function selectBackupsToPrune(
  names: readonly string[],
  keep: number = AUTOMATIC_BACKUPS_KEPT
): string[] {
  return automaticBackupsNewestFirst(names).slice(keep);
}

/** The newest automatic backup among `names`, or undefined if there is none. */
export function newestAutomaticBackup(names: readonly string[]): string | undefined {
  return automaticBackupsNewestFirst(names)[0];
}
