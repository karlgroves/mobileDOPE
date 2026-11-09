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

import type { DOPELogPrefill } from '../../../src/navigation/types';

/**
 * Quick entry from the Dashboard: the `prefill` route param (#245).
 *
 * The Dashboard's Confirm Shot has always navigated here with the shot it just
 * solved -- rifle, load, distance, both corrections and both units -- and this
 * screen read nothing but `logId`, so the param was computed, handed over and
 * dropped. The shooter got the same empty form as New DOPE Log and retyped
 * everything they had just dialled in.
 *
 * The precedence these tests pin, in the order of #242/PR #244: the shooter's
 * own choice, then an edited log's recorded values, then the prefill, then the
 * Settings defaults. The one exception is the dial-correction unit, which the
 * prefill takes above the rifle's turret: that unit is not a preference but the
 * unit the prefilled elevation and windage were solved in, and letting a MOA
 * turret relabel MIL numbers is the defect #230 fixed on this screen.
 */

const navigation = () =>
  ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }) as unknown as {
    navigate: jest.Mock;
    goBack: jest.Mock;
  };

const render = (params: { logId?: number; prefill?: DOPELogPrefill } = {}) =>
  renderWithProviders(
    <DOPELogEntry
      navigation={navigation() as never}
      route={{ params, key: 'k', name: 'DOPELogEdit' } as never}
    />
  );

type Screen = ReturnType<typeof render>;

/** The text actually sitting in a required number field. */
const fieldText = (screen: Screen, label: string): string | undefined =>
  screen.getByLabelText(`${label}, required`).props.value;

/** The selected option of a two-way unit control, off its own accessibilityState. */
const chosen = (screen: Screen, labels: string[]): string | undefined =>
  labels.find((label) => screen.getByLabelText(label).props.accessibilityState?.selected === true);

const chosenDistanceUnit = (screen: Screen) => chosen(screen, ['Yards', 'Meters']);
const chosenCorrectionUnit = (screen: Screen) => chosen(screen, ['MIL', 'MOA']);

/** A picker announces as "<label>: <selected option>", so this is its selection. */
const pickerSelection = (screen: Screen, label: string): string => {
  const node = screen.UNSAFE_getAllByProps({ label })[0];
  return String(node.props.value);
};

/** What the Dashboard hands over for a 600 m shot solved in MIL on rifle 2. */
const quickEntry = (overrides: Partial<DOPELogPrefill> = {}): DOPELogPrefill => ({
  rifleId: 2,
  ammoId: 2,
  distance: 600,
  distanceUnit: 'meters',
  elevationCorrection: 4.75,
  windageCorrection: -0.5,
  correctionUnit: 'MIL',
  ...overrides,
});

const rifle = (id: number, name: string, clickValueType: 'MIL' | 'MOA') =>
  new RifleProfile({ ...validRifle(), id, name, clickValueType });

const ammo = (id: number, name: string) => new AmmoProfile({ ...validAmmo(), id, name });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(dopeLogRepository, 'getLastFiredAt').mockResolvedValue(undefined);
  useDOPEStore.setState({ dopeLogs: [] });
  // Rifle 1 is what the form falls back to, and its turret is MOA so a prefill
  // that disagrees has something to beat.
  useRifleStore.setState({
    rifles: [rifle(1, 'Fallback Rifle', 'MOA'), rifle(2, 'Quick Entry Rifle', 'MOA')],
    loadRifles: jest.fn().mockResolvedValue(undefined),
  });
  useAmmoStore.setState({
    ammoProfiles: [ammo(1, '175gr SMK'), ammo(2, '168gr TMK')],
    loadAmmoProfiles: jest.fn().mockResolvedValue(undefined),
  });
  useEnvironmentStore.setState({ current: undefined } as never);
  useAppStore.setState((s) => ({
    settings: { ...s.settings, defaultDistanceUnit: 'yards', defaultCorrectionUnit: 'MOA' },
  }));
});

describe('Quick entry prefill on New DOPE Log (#245)', () => {
  it('seeds every field the Dashboard solved', async () => {
    const screen = render({ prefill: quickEntry() });

    await waitFor(() => {
      expect(pickerSelection(screen, 'Rifle Profile')).toBe('2');
    });
    expect(pickerSelection(screen, 'Ammunition')).toBe('2');
    expect(fieldText(screen, 'Target Distance')).toBe('600');
    expect(chosenDistanceUnit(screen)).toBe('Meters');
    expect(fieldText(screen, 'Elevation Correction')).toBe('4.75');
    expect(fieldText(screen, 'Windage Correction')).toBe('-0.50');
  });

  it("takes the prefill's correction unit over the rifle's turret", async () => {
    // Both rifles are MOA and Settings says MOA; the prefilled numbers were
    // solved in MIL, so MIL is what must label them.
    const screen = render({ prefill: quickEntry() });

    await waitFor(() => {
      expect(chosenCorrectionUnit(screen)).toBe('MIL');
    });
  });

  it("keeps the shooter's own choice over the prefill", async () => {
    const screen = render({ prefill: quickEntry() });
    await waitFor(() => {
      expect(chosenDistanceUnit(screen)).toBe('Meters');
    });

    fireEvent.press(screen.getByLabelText('Yards'));

    expect(chosenDistanceUnit(screen)).toBe('Yards');
  });

  it("keeps an edited log's recorded values over a prefill", async () => {
    const log = new DOPELog({
      id: 7,
      rifleId: 1,
      ammoId: 1,
      environmentId: 1,
      distance: 300,
      distanceUnit: 'yards',
      elevationCorrection: 2.25,
      windageCorrection: 0.25,
      correctionUnit: 'MOA',
      targetType: 'steel',
    });
    useDOPEStore.setState({ dopeLogs: [log] });
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(log);

    const screen = render({ logId: 7, prefill: quickEntry() });

    await waitFor(() => {
      expect(fieldText(screen, 'Target Distance')).toBe('300');
    });
    expect(pickerSelection(screen, 'Rifle Profile')).toBe('1');
    expect(pickerSelection(screen, 'Ammunition')).toBe('1');
    expect(chosenDistanceUnit(screen)).toBe('Yards');
    expect(fieldText(screen, 'Elevation Correction')).toBe('2.25');
    expect(fieldText(screen, 'Windage Correction')).toBe('0.25');
    expect(chosenCorrectionUnit(screen)).toBe('MOA');
  });

  it('leaves New DOPE Log alone when there is no prefill', async () => {
    const screen = render();

    await waitFor(() => {
      expect(fieldText(screen, 'Target Distance')).toBe('100');
    });
    expect(pickerSelection(screen, 'Rifle Profile')).toBe('1');
    expect(chosenDistanceUnit(screen)).toBe('Yards');
    expect(fieldText(screen, 'Elevation Correction')).toBe('0.00');
    expect(fieldText(screen, 'Windage Correction')).toBe('0.00');
    expect(chosenCorrectionUnit(screen)).toBe('MOA');
  });
});
