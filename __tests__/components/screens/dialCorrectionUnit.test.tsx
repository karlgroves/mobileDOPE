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
 * The Dial Corrections unit on New DOPE Log (#230).
 *
 * The unit used to start at a fixed 'MIL' whatever the rifle's turret or the
 * Settings default said, so a shooter dialling a MOA turret could save MOA
 * numbers labelled MIL. It now starts at the selected rifle's click value
 * type, falling back to Settings -> Default Units -> Angular Unit.
 *
 * The Settings fallback is not asserted on its own: the form only renders once
 * a rifle with an id is selected (no rifles shows an empty state instead), and
 * every rifle carries a click value type, so the rifle always decides. The
 * second case below pins that the rifle wins over a disagreeing Settings value.
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
  ['MIL', 'MOA'].find(
    (label) => screen.getByLabelText(label).props.accessibilityState?.selected === true
  );

const rifle = (id: number, name: string, clickValueType: 'MIL' | 'MOA') =>
  new RifleProfile({ ...validRifle(), id, name, clickValueType });

const setDefaultUnit = (defaultCorrectionUnit: 'MIL' | 'MOA') =>
  useAppStore.setState((s) => ({ settings: { ...s.settings, defaultCorrectionUnit } }));

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(dopeLogRepository, 'getLastFiredAt').mockResolvedValue(undefined);
  useDOPEStore.setState({ dopeLogs: [] });
  useAmmoStore.setState({
    ammoProfiles: [new AmmoProfile({ ...validAmmo(), id: 1 })],
    loadAmmoProfiles: jest.fn().mockResolvedValue(undefined),
  });
  useEnvironmentStore.setState({ current: undefined } as never);
  setDefaultUnit('MIL');
});

describe('Dial Corrections unit on New DOPE Log (#230)', () => {
  it("starts at the selected rifle's click value type", async () => {
    // Settings says MIL; the rifle's turret is MOA. The turret decides.
    useRifleStore.setState({
      rifles: [rifle(1, 'MOA Rifle', 'MOA')],
      loadRifles: jest.fn().mockResolvedValue(undefined),
    });

    const screen = render();

    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('MOA');
    });
  });

  it('starts at MIL for a MIL rifle even when Settings says MOA', async () => {
    setDefaultUnit('MOA');
    useRifleStore.setState({
      rifles: [rifle(1, 'MIL Rifle', 'MIL')],
      loadRifles: jest.fn().mockResolvedValue(undefined),
    });

    const screen = render();

    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('MIL');
    });
  });

  it('follows the rifle when the shooter picks a different one', async () => {
    useRifleStore.setState({
      rifles: [rifle(1, 'MIL Rifle', 'MIL'), rifle(2, 'MOA Rifle', 'MOA')],
      loadRifles: jest.fn().mockResolvedValue(undefined),
    });

    const screen = render();
    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('MIL');
    });

    const picker = screen.UNSAFE_getAllByProps({ label: 'Rifle Profile' })[0];
    picker.props.onValueChange('2');

    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('MOA');
    });
  });

  it("keeps the shooter's own choice over the rifle's", async () => {
    useRifleStore.setState({
      rifles: [rifle(1, 'MIL Rifle', 'MIL')],
      loadRifles: jest.fn().mockResolvedValue(undefined),
    });

    const screen = render();
    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('MIL');
    });

    fireEvent.press(screen.getByLabelText('MOA'));

    expect(chosenUnit(screen)).toBe('MOA');
  });

  it("keeps an edited log's recorded unit whatever the rifle says", async () => {
    useRifleStore.setState({
      rifles: [rifle(1, 'MIL Rifle', 'MIL')],
      loadRifles: jest.fn().mockResolvedValue(undefined),
    });
    const log = new DOPELog({
      id: 7,
      rifleId: 1,
      ammoId: 1,
      environmentId: 1,
      distance: 300,
      distanceUnit: 'yards',
      elevationCorrection: 4.5,
      windageCorrection: 0.5,
      correctionUnit: 'MOA',
      targetType: 'steel',
    });
    useDOPEStore.setState({ dopeLogs: [log] });
    jest.spyOn(dopeLogRepository, 'getById').mockResolvedValue(log);

    const screen = render({ logId: 7 });

    await waitFor(() => {
      expect(chosenUnit(screen)).toBe('MOA');
    });
  });
});
