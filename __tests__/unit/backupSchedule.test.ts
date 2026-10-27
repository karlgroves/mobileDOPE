import {
  AUTOMATIC_BACKUPS_KEPT,
  automaticBackupFilename,
  isBackupDue,
  newestAutomaticBackup,
  selectBackupsToPrune,
} from '../../src/utils/backupSchedule';

/**
 * Automatic backup scheduling (#66).
 *
 * There is no background-task module in the app, so "daily" means "the first
 * time the app is opened or brought back to the foreground once a day has
 * passed since the last automatic backup". These pin the two decisions that
 * rule rests on -- is one due, and which old files go -- without a clock or a
 * file system.
 */

const NOW = new Date('2026-10-26T12:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('isBackupDue', () => {
  it('is never due on the manual schedule, however long it has been', () => {
    expect(isBackupDue('manual', undefined, NOW)).toBe(false);
    expect(isBackupDue('manual', hoursAgo(24 * 365), NOW)).toBe(false);
  });

  it('treats a schedule it does not recognise as manual', () => {
    // loadSettingsFromStorage does not validate the stored value.
    const corrupted = 'hourly' as unknown as Parameters<typeof isBackupDue>[0];
    expect(isBackupDue(corrupted, undefined, NOW)).toBe(false);
    expect(isBackupDue(corrupted, hoursAgo(24 * 365), NOW)).toBe(false);
  });

  it('is due straight away when no automatic backup has ever run', () => {
    expect(isBackupDue('daily', undefined, NOW)).toBe(true);
    expect(isBackupDue('weekly', undefined, NOW)).toBe(true);
  });

  it('runs daily once 24 hours have passed, not before', () => {
    expect(isBackupDue('daily', hoursAgo(23.9), NOW)).toBe(false);
    expect(isBackupDue('daily', hoursAgo(24), NOW)).toBe(true);
  });

  it('runs weekly once seven days have passed, not before', () => {
    expect(isBackupDue('weekly', hoursAgo(24 * 7 - 0.1), NOW)).toBe(false);
    expect(isBackupDue('weekly', hoursAgo(24 * 7), NOW)).toBe(true);
  });

  it('treats a last-run time in the future as due, so a clock set back cannot stall it', () => {
    // Without this a phone whose clock was a month fast when the last backup ran
    // would skip every backup for a month after the clock was corrected.
    expect(isBackupDue('daily', hoursAgo(-1), NOW)).toBe(true);
  });

  it('treats an unreadable last-run time as never having run', () => {
    expect(isBackupDue('daily', 'not a date', NOW)).toBe(true);
  });
});

describe('automaticBackupFilename', () => {
  it('names the file by its timestamp so the newest sorts last and is recognisable', () => {
    expect(automaticBackupFilename(NOW)).toBe(`mobiledope_auto_${NOW.getTime()}.json`);
  });
});

describe('selectBackupsToPrune', () => {
  const name = (h: number) => automaticBackupFilename(new Date(NOW.getTime() - h * 3_600_000));

  it('keeps the newest N and returns the rest, oldest included', () => {
    const files = [name(1), name(48), name(24), name(72)];
    expect(selectBackupsToPrune(files, 2).sort()).toEqual([name(48), name(72)].sort());
  });

  it('returns nothing while there are no more than N', () => {
    expect(selectBackupsToPrune([name(1), name(2)], 2)).toEqual([]);
  });

  it('never selects a file it did not write', () => {
    // A manual export, or anything else that ends up in the folder, is not
    // the scheduler's to delete.
    const files = [name(1), name(2), name(3), 'mobiledope_backup_1.json', 'notes.txt'];
    expect(selectBackupsToPrune(files, 1).sort()).toEqual([name(2), name(3)].sort());
  });

  it('compares timestamps numerically, not as text', () => {
    // 999 sorts after 1000 as a string.
    const files = ['mobiledope_auto_999.json', 'mobiledope_auto_1000.json'];
    expect(selectBackupsToPrune(files, 1)).toEqual(['mobiledope_auto_999.json']);
  });

  it(`keeps ${AUTOMATIC_BACKUPS_KEPT} by default`, () => {
    const files = Array.from({ length: AUTOMATIC_BACKUPS_KEPT + 3 }, (_, i) => name(i * 24));
    expect(selectBackupsToPrune(files)).toHaveLength(3);
  });
});

describe('newestAutomaticBackup', () => {
  it('picks the most recent automatic backup and ignores other files', () => {
    expect(
      newestAutomaticBackup([
        'mobiledope_auto_999.json',
        'mobiledope_auto_1000.json',
        'mobiledope_backup_5000.json',
      ])
    ).toBe('mobiledope_auto_1000.json');
  });

  it('is undefined when there are none', () => {
    expect(newestAutomaticBackup(['notes.txt'])).toBeUndefined();
    expect(newestAutomaticBackup([])).toBeUndefined();
  });
});

describe('automaticBackupFilename after the clock has been set back', () => {
  const DAY = 86_400_000;
  const later = Array.from({ length: AUTOMATIC_BACKUPS_KEPT }, (_, i) =>
    automaticBackupFilename(new Date(NOW.getTime() + (i + 1) * DAY))
  );

  it('stamps the new file above every existing one, so it is the newest', () => {
    const fresh = automaticBackupFilename(NOW, later);

    expect(newestAutomaticBackup([...later, fresh])).toBe(fresh);
  });

  it('never selects the file just written for pruning', () => {
    const fresh = automaticBackupFilename(NOW, later);

    expect(selectBackupsToPrune([...later, fresh])).not.toContain(fresh);
  });

  it('uses the plain time when the clock has not gone backwards', () => {
    const earlier = [automaticBackupFilename(new Date(NOW.getTime() - DAY))];

    expect(automaticBackupFilename(NOW, earlier)).toBe(`mobiledope_auto_${NOW.getTime()}.json`);
  });
});
