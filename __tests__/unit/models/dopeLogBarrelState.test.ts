import { DOPELog } from '../../../src/models/DOPELog';

import type { DOPELogRow } from '../../../src/types/database.types';

/**
 * The barrel-state fields carry through the model unchanged (#164).
 *
 * The distinction these guard is the whole point of the pair being nullable:
 * `undefined` is "nobody recorded it", `false` is "someone looked and the
 * barrel was warm". #165 averages cold-bore offsets against warm ones, so
 * collapsing the two would feed it shots that were never observed.
 */

const base = {
  rifleId: 1,
  ammoId: 1,
  environmentId: 1,
  distance: 600,
  distanceUnit: 'yards' as const,
  elevationCorrection: 4.1,
  windageCorrection: 0.3,
  correctionUnit: 'MIL' as const,
  targetType: 'steel' as const,
};

const row = (overrides: Partial<DOPELogRow>): DOPELogRow =>
  ({
    id: 1,
    rifle_id: 1,
    ammo_id: 1,
    environment_id: 1,
    distance: 600,
    distance_unit: 'yards',
    elevation_correction: 4.1,
    windage_correction: 0.3,
    correction_unit: 'MIL',
    target_type: 'steel',
    timestamp: '2026-10-22T18:00:00.000Z',
    ...overrides,
  }) as DOPELogRow;

describe('DOPELog barrel state (#164)', () => {
  describe('toRow', () => {
    it('writes 1 for a cold bore and 0 for a warm one', () => {
      expect(new DOPELog({ ...base, coldBoreShot: true }).toRow().cold_bore_shot).toBe(1);
      expect(new DOPELog({ ...base, coldBoreShot: false }).toRow().cold_bore_shot).toBe(0);
    });

    it('leaves the column unset when nothing was recorded', () => {
      // Not 0. The repository turns this into a NULL; a 0 would be a recorded
      // warm bore, which is a different claim.
      expect(new DOPELog(base).toRow().cold_bore_shot).toBeUndefined();
    });

    it('carries the shot number', () => {
      expect(new DOPELog({ ...base, shotNumberInSession: 3 }).toRow().shot_number_in_session).toBe(
        3
      );
    });
  });

  describe('fromRow', () => {
    it('reads 1 as cold and 0 as warm', () => {
      expect(DOPELog.fromRow(row({ cold_bore_shot: 1 })).coldBoreShot).toBe(true);
      expect(DOPELog.fromRow(row({ cold_bore_shot: 0 })).coldBoreShot).toBe(false);
    });

    it('reads a NULL column as not recorded, not as warm', () => {
      // SQLite hands back null; `orUndefined` is not enough on its own here,
      // because `Boolean(null)` is false and would silently invent a warm bore.
      const nulled = { ...row({}), cold_bore_shot: null } as unknown as DOPELogRow;
      expect(DOPELog.fromRow(nulled).coldBoreShot).toBeUndefined();
    });

    it('reads a missing column as not recorded', () => {
      // A row from before migration 007 has no such key at all.
      expect(DOPELog.fromRow(row({})).coldBoreShot).toBeUndefined();
      expect(DOPELog.fromRow(row({})).shotNumberInSession).toBeUndefined();
    });
  });

  describe('round trip', () => {
    it('survives toJSON and back', () => {
      const log = new DOPELog({ ...base, coldBoreShot: true, shotNumberInSession: 1 });
      const back = DOPELog.fromJSON(log.toJSON());
      expect(back.coldBoreShot).toBe(true);
      expect(back.shotNumberInSession).toBe(1);
    });

    it('accepts an older backup with neither field', () => {
      // Import is the path that matters: a JSON file exported before #164 has
      // no barrel state, and must still restore.
      const back = DOPELog.fromJSON({ ...base });
      expect(back.coldBoreShot).toBeUndefined();
      expect(back.shotNumberInSession).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('rejects a shot number below 1', () => {
      expect(() => new DOPELog({ ...base, shotNumberInSession: 0 })).toThrow(
        'Shot number in session must be a whole number of 1 or greater'
      );
    });

    it('rejects a fractional shot number', () => {
      expect(() => new DOPELog({ ...base, shotNumberInSession: 2.5 })).toThrow(
        'Shot number in session must be a whole number of 1 or greater'
      );
    });

    it('accepts the first shot', () => {
      expect(() => new DOPELog({ ...base, shotNumberInSession: 1 })).not.toThrow();
    });
  });
});
