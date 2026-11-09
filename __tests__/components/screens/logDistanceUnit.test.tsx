import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { DOPELogEntry } from '../../../src/screens/DOPELogEntry';
import { dopeLogRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validAmmo, validRifle } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * The Distance unit on New DOPE Log (#242).
 *
 * The unit used to start at a fixed 'yards' whatever Settings -> Default Units
 * -> Distance Unit said, so a shooter working in meters had to change it on
 * every log -- the same class of defect #230 fixed for the Dial Corrections
 * unit. Unlike that one there is no per-rifle distance unit, so Settings
 * decides for a new log; an edited log keeps its own recorded unit.
 */

const navigation = () =>
  ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }) as unknown as {
    navigate: jest.Mock;
    goBack: jest.Mock;
  };

const render = (params: { logId?: number } = {}) =>
  renderWithProviders(
    <DOPELogEntry
      navigation={navigation() as never}
      route={{ params, key: 'k', name: 'DOPELogEdit' } as never}
    />
  );

/** The selected unit, read off the radio's own accessibilityState. */
const chosenUnit = (screen: ReturnType<typeof render>): string | undefined =>
  ['Yards', 'Meters'].find(
    (label) => screen.getByLabelText(label).props.accessibilityState?.selected === true
  );

const setDefaultUnit = (defaultDistanceUnit: 'yards' | 'meters') =>
  useAppStore.setState((s) => ({ settings: { ...s.settings, defaultDistanceUnit } }));

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(dopeLogRepository, 'getLastFiredAt').mockResolvedValue(undefined);
  useDOPEStore.setState({ dopeLogs: [] });
  useRifleStore.setState({
    rifles: [new RifleProfile({ ...validRifle(), id: 1 })],
    loadRifles: jest.fn().mockResolvedValue(undefined),
  });
  useAmmoStore.setState({
    ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 1 })],
    loadAmmoProfiles: jest.fn().mockResolvedValue(undefined),
  });
  useEnvironmentStore.setState({ current: undefined } as never);
  setDefaultUnit('yards');
});

describe('Distance unit on New DOPE Log (#242)', () => {
  it('starts at the Settings default when that is meters', async () => {
    setDefaultUnit('meters');

    const screen = render();

    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('Meters');
    });
  });

  it('starts at the Settings default when that is yards', async () => {
    const screen = render();

    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('Yards');
    });
  });

  it("keeps the shooter's own choice over the Settings default", async () => {
    setDefaultUnit('meters');

    const screen = render();
    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('Meters');
    });

    fireEvent.press(screen.getByLabelText('Yards'));

    expect(chosenUnit(screen)).toBe('Yards');
  });

  it("keeps an edited log's recorded unit whatever Settings says", async () => {
    setDefaultUnit('meters');
    const log = new DOPELog({
      id: 7,
      rifleId: 1,
      ammoId: 1,
      environmentId: 1,
      distance: 300,
      distanceUnit: 'yards',
      elevationCorrection: 4.5,
      windageCorrection: 0.5,
      correctionUnit: 'MIL',
      targetType: 'steel',
    });
    useDOPEStore.setState({ dopeLogs: [log] });
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(log);

    const screen = render({ logId: 7 });

    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('Yards');
    });
  });
});
