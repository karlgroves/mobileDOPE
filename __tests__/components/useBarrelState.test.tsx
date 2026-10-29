import { render, waitFor } from '@testing-library/react-native';
import React from 'react';

import { useBarrelState } from '../../src/hooks/useBarrelState';
import { DOPELog } from '../../src/models/DOPELog';
import { environmentRepository } from '../../src/services/database';
import { useAmmoStore } from '../../src/store/useAmmoStore';
import { useDOPEStore } from '../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../src/store/useRifleStore';
import { calculateBallisticSolution } from '../../src/utils/ballistics';

import type { BarrelStateResult } from '../../src/hooks/useBarrelState';
import type { DOPELogData } from '../../src/models/DOPELog';

/**
 * Cold-bore bias and heat shift, wired to real logs and a real solver (#165).
 *
 * `barrelStateAnalysis.test.ts` covers the statistics on hand-built samples.
 * What this asserts is the half #183 left unbuilt: that the hook turns logs
 * into those samples correctly -- offsets against the solver **in each log's
 * own conditions**, never raw dialled elevations -- and that it refuses to
 * answer before the conditions have been read back.
 *
 * The solver is real. The profiles are seeded in full for that reason: with
 * `zeroDistance`, `scopeHeight`, `twistRate`, `barrelLength` or the BC missing,
 * every prediction is dropped and the analysis silently reports nothing, so a
 * test on a stub profile would assert nothing at all.
 */

const rifle = {
  id: 1,
  name: 'Tikka T3x',
  caliber: '.308 Winchester',
  zeroDistance: 100,
  scopeHeight: 1.5,
  twistRate: '1:10',
  barrelLength: 24,
};

const ammo = {
  id: 1,
  name: 'Federal 175',
  caliber: '.308 Winchester',
  bulletWeight: 168,
  ballisticCoefficientG1: 0.462,
  ballisticCoefficientG7: 0,
  muzzleVelocity: 2650,
};

const snapshot = {
  id: 1,
  temperature: 59,
  pressure: 29.92,
  humidity: 50,
  altitude: 0,
  densityAltitude: 0,
};

/** The solver's own elevation at `yards`, in MIL, in `snapshot`'s air. */
const solverMil = (yards: number): number =>
  calculateBallisticSolution(
    {
      zeroDistance: rifle.zeroDistance,
      sightHeight: rifle.scopeHeight,
      twistRate: rifle.twistRate,
      barrelLength: rifle.barrelLength,
      caliber: rifle.caliber,
    },
    {
      bulletWeight: ammo.bulletWeight,
      ballisticCoefficient: ammo.ballisticCoefficientG1,
      dragModel: 'G1',
      muzzleVelocity: ammo.muzzleVelocity,
    },
    { distance: yards, angle: 0, windSpeed: 0, windDirection: 90 },
    {
      temperature: snapshot.temperature,
      pressure: snapshot.pressure,
      humidity: snapshot.humidity,
      altitude: snapshot.altitude,
      densityAltitude: snapshot.densityAltitude,
    },
    false
  ).elevationMIL;

let nextId = 1;

const log = (over: Partial<DOPELogData>): DOPELog =>
  new DOPELog({
    id: nextId++,
    rifleId: 1,
    ammoId: 1,
    environmentId: 1,
    distance: 500,
    distanceUnit: 'yards',
    elevationCorrection: 3.1,
    windageCorrection: 0,
    correctionUnit: 'MIL',
    targetType: 'steel',
    timestamp: new Date().toISOString(),
    ...over,
  } as DOPELogData);

/** Captures the hook's result from a component that renders nothing. */
const Probe: React.FC<{ onResult: (r: BarrelStateResult) => void; shotNumber?: number }> = ({
  onResult,
  shotNumber = 1,
}) => {
  onResult(useBarrelState({ rifleId: 1, ammoId: 1, shotNumber, unit: 'MIL' }));
  return null;
};

/** Renders the probe over `logs` and returns the latest result. */
const observe = async (
  logs: DOPELog[],
  shotNumber = 1,
  { withStoreSnapshots = true }: { withStoreSnapshots?: boolean } = {}
): Promise<{ latest: () => BarrelStateResult }> => {
  useDOPEStore.setState({ dopeLogs: logs });
  // The store's recent snapshots are joined over the ones loaded by id, so a
  // test about an unreadable snapshot has to empty both.
  useEnvironmentStore.setState({
    snapshots: (withStoreSnapshots ? [snapshot] : []) as never,
    current: null,
  });
  useRifleStore.setState({ rifles: [rifle] as never });
  useAmmoStore.setState({ ammoProfiles: [ammo] as never });

  let result: BarrelStateResult | undefined;
  render(
    <Probe
      shotNumber={shotNumber}
      onResult={(r) => {
        result = r;
      }}
    />
  );

  await waitFor(() => expect(result?.loading).toBe(false));
  return { latest: () => result as BarrelStateResult };
};

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 1;
  jest
    .spyOn(environmentRepository, 'getById')
    .mockImplementation(() => Promise.resolve(snapshot as never));
});

describe('useBarrelState with enough cold and warm logs (#165)', () => {
  /**
   * Three cold shots dialled 0.3 MIL higher than three warm ones at the same
   * distance and in the same air. Whatever the solver predicts for 500 yd, it
   * predicts the same figure for all six -- so the bias is exactly the 0.3
   * difference between the dialled elevations, with no dependence on the
   * trajectory at all.
   */
  const COLD_MINUS_WARM = 0.3;

  const string = (): DOPELog[] => [
    ...Array.from({ length: 3 }, () =>
      log({ coldBoreShot: true, shotNumberInSession: 1, elevationCorrection: 3.4 })
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      log({ coldBoreShot: false, shotNumberInSession: 2 + i, elevationCorrection: 3.1 })
    ),
  ];

  it('measures the bias as the difference between dialled elevations', async () => {
    const { latest } = await observe(string());

    expect(latest().analysis.coldBore?.bias).toBeCloseTo(COLD_MINUS_WARM, 6);
    expect(latest().analysis.coldBore?.coldSamples).toBe(3);
    expect(latest().analysis.coldBore?.warmSamples).toBe(3);
  });

  it('offers the bias as the correction to apply, with its own sign', async () => {
    const { latest } = await observe(string());

    expect(latest().coldBoreCorrection).toBeCloseTo(COLD_MINUS_WARM, 6);
  });

  it('describes it in the issue’s own words', async () => {
    const { latest } = await observe(string());

    expect(latest().coldBoreCaption).toBe('Expected cold-bore shift: 0.30 MIL low');
  });

  it('combines logs shot at different distances, because offsets are comparable', async () => {
    // The property the whole module rests on. Three cold shots at 300 yd, each
    // dialled 0.4 MIL above what the solver asks for there, and three warm at
    // 600 yd dialled 0.1 above what it asks for there. The bias is the 0.3
    // between those two *errors*, not the ~3 MIL between the raw elevations --
    // which is what averaging dialled figures across distances would produce.
    const atDistance = (yards: number, over: Partial<DOPELogData>): DOPELog =>
      log({ distance: yards, ...over });

    const { latest } = await observe([
      ...Array.from({ length: 3 }, () =>
        atDistance(300, {
          coldBoreShot: true,
          shotNumberInSession: 1,
          elevationCorrection: solverMil(300) + 0.4,
        })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        atDistance(600, {
          coldBoreShot: false,
          shotNumberInSession: 2 + i,
          elevationCorrection: solverMil(600) + 0.1,
        })
      ),
    ]);

    // Loose only because `perLogElevation` reads a tabulated trajectory at
    // whole yards while `solverMil` solves the distance directly; the point is
    // that it is near 0.3 and nowhere near the 3.3 MIL trajectory gap.
    expect(latest().analysis.coldBore?.bias).toBeCloseTo(0.3, 1);
  });
});

describe('useBarrelState heat shift (#165)', () => {
  it('fits a slope across a string and predicts the drift at a shot', async () => {
    // Twenty shots, each dialled 0.02 MIL more than the last, all at the same
    // distance in the same air -- so the solver's prediction is constant and
    // the fitted slope is the 0.02 that was dialled in.
    const { latest } = await observe(
      Array.from({ length: 20 }, (_, i) =>
        log({ shotNumberInSession: i + 1, elevationCorrection: 3.1 + i * 0.02 })
      ),
      11
    );

    expect(latest().analysis.heatShift?.perShot).toBeCloseTo(0.02, 6);
    expect(latest().analysis.heatShift?.shots).toBe(20);
    expect(latest().heatShiftCorrection).toBeCloseTo(0.2, 6);
    expect(latest().heatShiftCaption).toBe('Barrel heating: 0.20 MIL low expected by shot 11');
  });

  it('offers no correction for a slope it did not report', async () => {
    // A flat string: the slope is fitted but below the threshold, so there is
    // no caption -- and a correction the shooter was never told about is not a
    // correction they chose.
    const { latest } = await observe(
      Array.from({ length: 20 }, (_, i) =>
        log({ shotNumberInSession: i + 1, elevationCorrection: 3.1 })
      ),
      11
    );

    expect(latest().analysis.heatShift).toBeDefined();
    expect(latest().heatShiftCaption).toBeUndefined();
    expect(latest().heatShiftCorrection).toBeUndefined();
  });
});

describe('useBarrelState refuses to answer (#165)', () => {
  it('reports nothing for a rifle with no barrel-state logs at all', async () => {
    const { latest } = await observe([log({}), log({}), log({})]);

    expect(latest().analysis).toEqual({ coldBore: undefined, heatShift: undefined });
    expect(latest().coldBoreCaption).toBeUndefined();
    expect(latest().loading).toBe(false);
  });

  it('ignores logs that recorded no barrel state at all', async () => {
    // Filtering them out is what keeps `perLogElevation` off a whole history
    // to answer a question only post-#176 logs can speak to (#124). It changes
    // no result, which is the property asserted here: three cold and three warm
    // give the same bias with or without fifty unflagged logs beside them.
    const string = [
      ...Array.from({ length: 3 }, () =>
        log({ coldBoreShot: true, shotNumberInSession: 1, elevationCorrection: 3.4 })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        log({ coldBoreShot: false, shotNumberInSession: 2 + i, elevationCorrection: 3.1 })
      ),
    ];
    const noise = Array.from({ length: 50 }, () => log({ elevationCorrection: 9.9 }));

    const clean = await observe(string);
    const cleanBias = clean.latest().analysis.coldBore?.bias;

    nextId = 1;
    const noisy = await observe([...string.map((l) => log({ ...l } as DOPELogData)), ...noise]);

    expect(noisy.latest().analysis.coldBore?.bias).toBeCloseTo(cleanBias as number, 6);
  });

  it('reports nothing for a rifle and load with no profiles', async () => {
    useRifleStore.setState({ rifles: [] as never });
    const { latest } = await observe([
      log({ coldBoreShot: true, shotNumberInSession: 1 }),
      log({ coldBoreShot: true, shotNumberInSession: 1 }),
      log({ coldBoreShot: true, shotNumberInSession: 1 }),
    ]);

    expect(latest().analysis.coldBore).toBeUndefined();
  });

  it('drops a log whose own conditions could not be read', async () => {
    // Its offset is unknowable, not zero. Counting it as agreeing with the
    // solver would pull a measured bias towards nothing.
    //
    // The logs here reference a snapshot that is in neither the store nor the
    // repository, so there is genuinely no air to predict them in. Seeded with
    // cold and warm dialled 0.3 apart, which WOULD give a bias if they were
    // predicted at all -- so the assertion is about the drop, not about there
    // being nothing to find.
    jest.spyOn(environmentRepository, 'getById').mockImplementation(() => Promise.resolve(null));

    const { latest } = await observe(
      [
        ...Array.from({ length: 3 }, () =>
          log({
            environmentId: 99,
            coldBoreShot: true,
            shotNumberInSession: 1,
            elevationCorrection: 3.4,
          })
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          log({
            environmentId: 99,
            coldBoreShot: false,
            shotNumberInSession: 2 + i,
            elevationCorrection: 3.1,
          })
        ),
      ],
      1,
      { withStoreSnapshots: false }
    );

    expect(latest().analysis.coldBore).toBeUndefined();
    expect(latest().analysis.heatShift).toBeUndefined();
  });
});
