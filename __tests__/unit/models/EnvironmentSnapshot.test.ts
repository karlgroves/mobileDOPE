import { EnvironmentSnapshot } from '../../../src/models/EnvironmentSnapshot';
import { EnvironmentSnapshotRow } from '../../../src/types/database.types';

/**
 * Privacy behaviour of the only entity in the app that records where the user was.
 *
 * The model is the chokepoint: every write path (repository, import, factory)
 * constructs one of these, so coarsening here means no full-precision coordinate
 * can reach the database regardless of caller. See issue #44.
 */
const base = {
  temperature: 59,
  humidity: 50,
  pressure: 29.92,
  altitude: 1000,
  windSpeed: 5,
  windDirection: 90,
};

describe('EnvironmentSnapshot coordinate handling', () => {
  it('coarsens a supplied latitude at construction', () => {
    const snapshot = new EnvironmentSnapshot({ ...base, latitude: 39.739236 });
    expect(snapshot.latitude).toBe(39.7);
  });

  it('never retains the full-precision value it was given', () => {
    const precise = 39.739236;
    const snapshot = new EnvironmentSnapshot({ ...base, latitude: precise });

    expect(snapshot.latitude).not.toBe(precise);
    expect(String(snapshot.latitude).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it('leaves an absent latitude absent', () => {
    const snapshot = new EnvironmentSnapshot({ ...base });
    expect(snapshot.latitude).toBeUndefined();
  });

  it('treats a NULL column as absent rather than as the equator', () => {
    // SQLite hands back `null`, not `undefined`. Rounding that would produce 0 --
    // a fabricated coordinate, and a wrong one.
    const snapshot = new EnvironmentSnapshot({
      ...base,
      latitude: null as unknown as number,
    });
    expect(snapshot.latitude).toBeUndefined();
  });

  it('still rejects an out-of-range latitude', () => {
    expect(() => new EnvironmentSnapshot({ ...base, latitude: 91 })).toThrow();
    expect(() => new EnvironmentSnapshot({ ...base, latitude: -91 })).toThrow();
  });

  it('does not expose a longitude property', () => {
    const snapshot = new EnvironmentSnapshot({ ...base, latitude: 39.7 });
    expect('longitude' in snapshot).toBe(false);
  });

  it('coarsens a latitude read back from a row', () => {
    // Rows written before the migration may still hold full precision.
    const row = {
      id: 1,
      temperature: 59,
      humidity: 50,
      pressure: 29.92,
      altitude: 1000,
      density_altitude: 1200,
      wind_speed: 5,
      wind_direction: 90,
      latitude: 39.739236,
      timestamp: '2026-01-01T00:00:00.000Z',
    } as EnvironmentSnapshotRow;

    expect(EnvironmentSnapshot.fromRow(row).latitude).toBe(39.7);
  });
});

describe('EnvironmentSnapshot serialisation', () => {
  it('omits longitude from toJSON', () => {
    const json = new EnvironmentSnapshot({ ...base, latitude: 39.7 }).toJSON();
    expect(json).not.toHaveProperty('longitude');
  });

  it('emits only the coarsened latitude in toJSON', () => {
    const json = new EnvironmentSnapshot({ ...base, latitude: 39.739236 }).toJSON();
    expect(json.latitude).toBe(39.7);
  });

  it('omits longitude from the database row', () => {
    const row = new EnvironmentSnapshot({ ...base, latitude: 39.7 }).toRow();
    expect(row).not.toHaveProperty('longitude');
  });
});

describe('EnvironmentSnapshot light condition (#62)', () => {
  it('keeps the light the shooter recorded', () => {
    const snapshot = new EnvironmentSnapshot({ ...base, lightCondition: 'low_light' });
    expect(snapshot.lightCondition).toBe('low_light');
    expect(snapshot.toJSON().lightCondition).toBe('low_light');
    expect(snapshot.toRow().light_condition).toBe('low_light');
  });

  it('leaves an unrecorded light absent rather than assuming daylight', () => {
    const snapshot = new EnvironmentSnapshot(base);
    expect(snapshot.lightCondition).toBeUndefined();
  });

  it('treats a NULL column as unrecorded', () => {
    const row = {
      id: 1,
      temperature: 59,
      humidity: 50,
      pressure: 29.92,
      altitude: 1000,
      density_altitude: 1200,
      wind_speed: 5,
      wind_direction: 90,
      light_condition: null,
      timestamp: '2026-01-01T00:00:00.000Z',
    } as unknown as EnvironmentSnapshotRow;

    expect(EnvironmentSnapshot.fromRow(row).lightCondition).toBeUndefined();
  });

  it('reads the recorded light back from a row', () => {
    const row = {
      id: 1,
      temperature: 59,
      humidity: 50,
      pressure: 29.92,
      altitude: 1000,
      density_altitude: 1200,
      wind_speed: 5,
      wind_direction: 90,
      light_condition: 'night',
      timestamp: '2026-01-01T00:00:00.000Z',
    } as EnvironmentSnapshotRow;

    expect(EnvironmentSnapshot.fromRow(row).lightCondition).toBe('night');
  });

  it('rejects a light condition it does not know', () => {
    expect(() => new EnvironmentSnapshot({ ...base, lightCondition: 'dusk' as never })).toThrow(
      /Light condition/
    );
  });
});
