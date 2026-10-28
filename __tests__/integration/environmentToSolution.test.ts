import {
  ammoProfileRepository,
  environmentRepository,
  rifleProfileRepository,
} from '../../src/services/database';
import { useDOPEStore } from '../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../src/store/useEnvironmentStore';
import { calculateBallisticSolution } from '../../src/utils/ballistics';
import { perLogElevation } from '../../src/utils/perLogElevation';
import {
  ammoConfigFor,
  atmosphereFor,
  rifleConfigFor,
  STANDARD_ATMOSPHERE,
} from '../../src/utils/solverInputs';
import { validAmmo, validDopeLog, validEnvironment, validRifle } from '../helpers/fixtures';
import { installTestDatabase, uninstallTestDatabase } from '../helpers/testDatabase';

import type { EnvironmentSnapshotData } from '../../src/models/EnvironmentSnapshot';
import type { TestDatabase } from '../helpers/testDatabase';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: () => require('../helpers/testDatabase').openDatabaseAsync(),
}));

/**
 * Environmental capture, all the way into a solution (#68, "test environmental
 * data capture and its use in a solution").
 *
 * The path is the app's own, layer by layer, with nothing stubbed but the
 * native SQLite binding (swapped for `node:sqlite`, the same engine):
 *
 *   1. `EnvironmentInput` hands the readings to `setCurrent` and calls
 *      `saveCurrent` -- done here through the real store.
 *   2. `EnvironmentSnapshot` validates them, works out density altitude and
 *      coarsens latitude (#44), and the repository writes the row.
 *   3. A DOPE log is saved against that snapshot through the DOPE store.
 *   4. `useSnapshotsFor` reads each log's snapshot back by id, and
 *      `perLogElevation` -> `elevationTable` -> `atmosphereFor` turns it into
 *      the solver's prediction for that log. That prediction is what the DOPE
 *      curve's input corrections (#64) and the DOPE adjustment (#168) compare
 *      the shooter's logged dope against.
 *
 * The solver is the real one throughout. A mock could not answer the question
 * this suite asks -- whether the solution moves with the air, and the right
 * way -- because a mock moves however it was told to.
 *
 * Humidity is deliberately not asserted on: the drag model reads temperature
 * and pressure only (`calculateAirDensity`), so humid air changes nothing, and
 * pinning that would make adding humidity look like a regression. Altitude is
 * record-only by design (#89) and has its own suite, `altitudeIsRecordOnly`.
 */

const rifle = validRifle();
const ammo = validAmmo();
const YARDS = 800;

describe('environmental capture -> stored snapshot -> solution (#68)', () => {
  let db: TestDatabase;
  let rifleId: number;
  let ammoId: number;

  beforeEach(async () => {
    db = await installTestDatabase();
    useEnvironmentStore.setState({ current: null, snapshots: [] });
    useDOPEStore.setState({ dopeLogs: [] });
    // The profile rows the log's foreign keys need.
    rifleId = (await rifleProfileRepository.create(rifle)).id as number;
    ammoId = (await ammoProfileRepository.create(ammo)).id as number;
  });

  afterEach(async () => {
    await uninstallTestDatabase();
  });

  /** Steps 1-3: capture the conditions the way the Environment screen does, and log a shot in them. */
  const captureAndLog = async (conditions: Partial<EnvironmentSnapshotData>) => {
    const store = useEnvironmentStore.getState();
    store.setCurrent(validEnvironment(conditions));
    const snapshot = await useEnvironmentStore.getState().saveCurrent();
    const log = await useDOPEStore
      .getState()
      .createDopeLog(
        validDopeLog({ rifleId, ammoId, environmentId: snapshot.id as number }, { distance: YARDS })
      );
    return { snapshot, log };
  };

  /** Step 4: read the snapshot back as `useSnapshotsFor` does, and predict the log. */
  const predicted = async (conditions: Partial<EnvironmentSnapshotData>): Promise<number> => {
    const { log } = await captureAndLog(conditions);
    const stored = await environmentRepository.getById(log.environmentId);
    expect(stored).not.toBeNull();
    const byId = new Map([[stored!.id as number, stored!]]);
    const elevation = perLogElevation([log], rifle, ammo, byId, 'MIL')(log, YARDS);
    expect(elevation).toBeDefined();
    return elevation as number;
  };

  it('stores what was captured, with latitude coarsened and no longitude', async () => {
    // A phone's fix, at full precision. The snapshot is the chokepoint (#44):
    // whatever the screen passes, one decimal place is all that reaches disk.
    const { snapshot } = await captureAndLog({
      temperature: 21,
      pressure: 25.42,
      humidity: 30,
      latitude: 44.987654,
    });

    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM environment_snapshots WHERE id = ?',
      [snapshot.id]
    );

    expect(row).toMatchObject({ temperature: 21, pressure: 25.42, humidity: 30, latitude: 45 });
    expect(Object.keys(row ?? {})).not.toContain('longitude');
    // And the solver is handed exactly what was entered: nothing is lost or
    // converted on the way through a REAL column.
    const stored = await environmentRepository.getById(snapshot.id as number);
    expect(atmosphereFor(stored!)).toEqual({
      temperature: 21,
      pressure: 25.42,
      humidity: 30,
      altitude: 0,
    });
  });

  it('predicts more elevation in cold air than in hot air', async () => {
    // Same pressure, colder air: denser, more drag, more drop.
    const cold = await predicted({ temperature: 10 });
    const hot = await predicted({ temperature: 100 });

    expect(cold).toBeGreaterThan(hot);
    // Not a rounding-error difference: 90 °F at 800 yd is a real correction.
    expect(cold - hot).toBeGreaterThan(0.3);
  });

  it('predicts more elevation at high station pressure than at low', async () => {
    // Sea-level pressure against a mountain range's, same temperature.
    const sea = await predicted({ pressure: 30.1 });
    const mountain = await predicted({ pressure: 24.9 });

    expect(sea).toBeGreaterThan(mountain);
    expect(sea - mountain).toBeGreaterThan(0.3);
  });

  it('orders predictions by the density altitude the snapshot recorded', async () => {
    // The snapshot works out density altitude itself; the solver works from
    // temperature and pressure. Two models of the same air, so they must agree
    // on its ORDER: thinner air (higher DA) never needs more elevation.
    const days: Partial<EnvironmentSnapshotData>[] = [
      { temperature: 95, pressure: 24.6 },
      { temperature: 20, pressure: 30.3 },
      { temperature: 59, pressure: 29.92 },
      { temperature: 75, pressure: 27.5 },
      { temperature: 40, pressure: 26.0 },
    ];

    const results: { densityAltitude: number; elevation: number }[] = [];
    for (const day of days) {
      const elevation = await predicted(day);
      const [latest] = useEnvironmentStore.getState().snapshots;
      results.push({ densityAltitude: latest.densityAltitude, elevation });
    }

    const byDensityAltitude = [...results].sort((a, b) => a.densityAltitude - b.densityAltitude);
    const elevations = byDensityAltitude.map((r) => r.elevation);
    expect(elevations).toEqual([...elevations].sort((a, b) => b - a));
  });

  it('predicts a standard-day snapshot exactly as the standard atmosphere', async () => {
    // The two ways a log can be predicted -- in its own conditions, or in the
    // standard atmosphere when it has none -- must meet on a standard day.
    const standard = await predicted({ temperature: 59, pressure: 29.92, humidity: 50 });
    const anyLog = { distance: YARDS, distanceUnit: 'yards' as const, environmentId: 1 };
    const unconditioned = perLogElevation(
      [anyLog],
      rifle,
      ammo,
      new Map([[1, STANDARD_ATMOSPHERE as never]]),
      'MIL'
    )(anyLog, YARDS);

    expect(standard).toBeCloseTo(unconditioned as number, 10);
  });

  it('loses nothing the Coriolis term can use by coarsening latitude', async () => {
    // The privacy claim in `geoPrecision` is that a tenth of a degree is finer
    // than the model can use. Checked here against the real solver rather than
    // the trigonometry: the stored latitude and the raw fix give the same
    // correction to well under a click at 1000 yd.
    //
    // NB no production path yet feeds a snapshot's latitude to the solver --
    // the calculator does not pass `shot.latitude` -- so this is the claim
    // that would have to hold when one does, not a path the app takes today.
    const raw = 44.987654;
    const { snapshot } = await captureAndLog({ latitude: raw });
    const solve = (latitude: number) =>
      calculateBallisticSolution(
        rifleConfigFor(rifle),
        ammoConfigFor(ammo),
        { distance: 1000, angle: 0, windSpeed: 0, windDirection: 0, latitude, azimuth: 90 },
        atmosphereFor(snapshot)
      );

    const fromRaw = solve(raw);
    const fromStored = solve(snapshot.latitude as number);

    expect(snapshot.latitude).toBe(45);
    expect(
      Math.abs(fromRaw.coriolisHorizontalMIL! - fromStored.coriolisHorizontalMIL!)
    ).toBeLessThan(0.01);
    expect(Math.abs(fromRaw.coriolisVerticalMIL! - fromStored.coriolisVerticalMIL!)).toBeLessThan(
      0.01
    );
  });
});
