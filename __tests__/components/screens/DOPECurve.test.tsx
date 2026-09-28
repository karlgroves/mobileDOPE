import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { EnvironmentSnapshot } from '../../../src/models/EnvironmentSnapshot';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { DOPECurve } from '../../../src/screens/DOPECurve';
import { environmentRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { predictElevation } from '../../../src/utils/solverInputs';
import { validAmmo, validEnvironment, validRifle } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * The DOPE curve suggests muzzle-velocity and BC changes from logged DOPE (#64).
 *
 * The analysis functions were written, tested and shown nowhere. These assert
 * what the shooter sees and what Apply writes, with the stores seeded rather
 * than mocked. The chart itself is Skia and is stubbed out, and the solver is
 * replaced by a fast stand-in (below).
 */

/**
 * A fast stand-in for the solver. Under this project's React Native transform a
 * real solve takes ~150 ms, and the screen's reference curve alone is 19 of
 * them -- enough to push each test toward the 5 s timeout. The stand-in keeps
 * what these tests depend on: drop grows with distance, and colder air needs
 * more elevation. The real mapping is covered in solverInputs.test.ts and
 * inputCorrections.test.ts.
 */
jest.mock('../../../src/utils/solverInputs', () => ({
  ...jest.requireActual('../../../src/utils/solverInputs'),
  predictElevation: (
    _rifle: unknown,
    _ammo: unknown,
    yards: number,
    env: { temperature: number } | undefined,
    unit: 'MIL' | 'MOA'
  ) => {
    const mil = (yards / 100) * (1 + (59 - (env?.temperature ?? 59)) / 200);
    return unit === 'MIL' ? mil : mil * 3.438;
  },
}));
jest.mock('victory-native', () => {
  const mockNothing = () => null;
  return { CartesianChart: mockNothing, Line: mockNothing };
});
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

const rifleData = { ...validRifle(), id: 1 };
const ammoData = { ...validAmmo({ muzzleVelocity: 2700 }), id: 1 };
const standard = undefined;

/** Logs at `yards`, each the solver's prediction in `env` plus `offset` MIL. */
const logsAt = (
  yards: number[],
  offset: number | ((yards: number) => number),
  env: Parameters<typeof predictElevation>[3] = standard,
  environmentId = 5
): DOPELog[] =>
  yards.map(
    (distance, i) =>
      new DOPELog({
        id: i + 1,
        rifleId: 1,
        ammoId: 1,
        environmentId,
        distance,
        distanceUnit: 'yards',
        elevationCorrection:
          predictElevation(rifleData, ammoData, distance, env, 'MIL') +
          (typeof offset === 'number' ? offset : offset(distance)),
        windageCorrection: 0,
        correctionUnit: 'MIL',
        targetType: 'steel',
      })
  );

const route = {
  params: { rifleId: 1, ammoId: 1 },
  key: 'k',
  name: 'DOPECurve',
} as unknown as Parameters<typeof DOPECurve>[0]['route'];
const navigation = {} as Parameters<typeof DOPECurve>[0]['navigation'];

const updateAmmoProfile = jest.fn().mockResolvedValue(undefined);

const seed = (logs: DOPELog[]) => {
  useRifleStore.setState({ rifles: [new RifleProfile(rifleData)] });
  useAmmoStore.setState({ ammoProfiles: [new AmmoProfile(ammoData)], updateAmmoProfile });
  useDOPEStore.setState({ dopeLogs: logs });
};

describe('DOPECurve: solver input suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(environmentRepository, 'getById').mockResolvedValue(null);
  });

  it('suggests a lower muzzle velocity when logs need more elevation than predicted', async () => {
    seed(logsAt([300, 500, 700], 0.5));
    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);

    expect(await findByText('Solver inputs')).toBeTruthy();
    expect(await findByText(/^2700 → \d+ fps$/)).toBeTruthy();
  });

  it("predicts each log in its own snapshot's conditions", async () => {
    // Logged exactly on the solver in cold, dense air. Against its own snapshot
    // it agrees; against the standard atmosphere it would suggest a change.
    const cold = { ...validEnvironment({ temperature: 0, pressure: 30.8 }), id: 9 };
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => (id === 9 ? new EnvironmentSnapshot(cold) : null));
    seed(logsAt([300, 500, 700, 900], 0, cold, 9));

    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);

    expect(await findByText(/agrees with the solver/)).toBeTruthy();
    expect(environmentRepository.getById).toHaveBeenCalledWith(9);
  });

  it('asks before changing the profile, then writes only the suggested field', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seed(logsAt([300, 500, 700], 0.5));
    const { findByRole } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);

    fireEvent.press(await findByRole('button', { name: /^Use \d+ fps$/ }));

    expect(updateAmmoProfile).not.toHaveBeenCalled();
    const [title, , buttons] = alert.mock.calls[0];
    expect(title).toMatch(/muzzle velocity/i);
    const confirm = (buttons as { text: string; onPress?: () => void }[]).find(
      (b) => b.text === 'Update'
    );
    confirm?.onPress?.();

    await waitFor(() => expect(updateAmmoProfile).toHaveBeenCalledTimes(1));
    const [id, data] = updateAmmoProfile.mock.calls[0];
    expect(id).toBe(1);
    expect(data.muzzleVelocity).toBeLessThan(2700);
    expect(data.ballisticCoefficientG7).toBe(ammoData.ballisticCoefficientG7);
    expect(data.name).toBe(ammoData.name);
  });

  it('writes a BC suggestion to the coefficient the solver is using', async () => {
    // A gap that grows with distance points at BC. This load has a G7, so that
    // is the field that changes -- not G1, and not the velocity.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    seed(logsAt([300, 500, 700, 900], (yards) => (yards - 300) / 300));
    const { findByRole } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);

    fireEvent.press(await findByRole('button', { name: /^Use G7 BC / }));
    const [title, , buttons] = alert.mock.calls[0];
    expect(title).toMatch(/G7 BC/);
    (buttons as { text: string; onPress?: () => void }[])
      .find((b) => b.text === 'Update')
      ?.onPress?.();

    await waitFor(() => expect(updateAmmoProfile).toHaveBeenCalledTimes(1));
    const [, data] = updateAmmoProfile.mock.calls[0];
    expect(data.ballisticCoefficientG7).toBeLessThan(ammoData.ballisticCoefficientG7);
    expect(data.ballisticCoefficientG1).toBe(ammoData.ballisticCoefficientG1);
    expect(data.muzzleVelocity).toBe(ammoData.muzzleVelocity);
  });
});
