import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { DOPELogEntry } from '../../../src/screens/DOPELogEntry';
import { dopeLogRepository } from '../../../src/services/database';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { validAmmo, validRifle } from '../../helpers/fixtures';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * The barrel-state control on New DOPE Log (#164).
 *
 * #164 asks that cold bore is suggested, changeable, and never silently
 * assumed. All three are behaviour of this screen rather than of
 * `suggestColdBore`, so they are asserted here.
 *
 * Both failures these cover were in the first cut of this feature and neither
 * showed up in the unit tests: the suggestion read the in-memory DOPE store,
 * which only DOPE Logs fills, so it said "cold bore" to a shooter who had
 * fired a minute earlier; and choosing "Not recorded" deliberately looked
 * identical to the untouched default, so the effect overwrote it on the next
 * render.
 */

const navigation = () =>
  ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn() }) as unknown as {
    navigate: jest.Mock;
    goBack: jest.Mock;
  };

const route = () => ({ params: {}, key: 'k', name: 'DOPELogEdit' }) as never;

const render = () =>
  renderWithProviders(<DOPELogEntry navigation={navigation() as never} route={route()} />);

/**
 * Which barrel-state option is selected, read off the radio's own
 * `accessibilityState` rather than off the label being present -- all three
 * labels are always present, so asserting on presence pins nothing.
 */
const chosenBarrelState = (screen: ReturnType<typeof render>): string | undefined =>
  ['Not recorded', 'Cold bore', 'Warm bore'].find(
    (label) => screen.getByLabelText(label).props.accessibilityState?.selected === true
  );

beforeEach(() => {
  jest.restoreAllMocks();
  // Empty, as it is for anyone who opens New DOPE Log without visiting DOPE
  // Logs first. The suggestion must not be judged against it.
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
});

describe('barrel state on New DOPE Log (#164)', () => {
  it('suggests cold bore when the rifle has not fired recently', async () => {
    jest
      .spyOn(dopeLogRepository, 'getLastFiredAt')
      .mockResolvedValue(new Date(Date.now() - 45 * 60_000).toISOString());

    const screen = render();

    await waitFor(() => {
      expect(chosenBarrelState(screen)).toBe('Cold bore');
    });
    // The real gap, not the threshold. The hint used to read "Suggested from
    // the 10 minutes since this rifle last fired" whatever the gap was, which
    // on this fixture -- 45 minutes -- was simply false. #164 asks that cold
    // bore is never silently assumed, and a hint stating the wrong reason
    // cannot be checked by the shooter it is shown to.
    expect(screen.getByText(/45 minutes ago, more than the 10-minute cold-bore gap/)).toBeTruthy();
  });

  it('says the rifle has no earlier logs rather than citing a gap it never measured', async () => {
    jest.spyOn(dopeLogRepository, 'getLastFiredAt').mockResolvedValue(undefined);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText(/no earlier logs/)).toBeTruthy();
    });
    expect(chosenBarrelState(screen)).toBe('Cold bore');
    expect(screen.queryByText(/cold-bore gap/)).toBeNull();
  });

  it('names the gap on the warm side too, so the two sides read the same way', async () => {
    jest
      .spyOn(dopeLogRepository, 'getLastFiredAt')
      .mockResolvedValue(new Date(Date.now() - 4 * 60_000).toISOString());

    const screen = render();

    await waitFor(() => {
      expect(chosenBarrelState(screen)).toBe('Warm bore');
    });
    expect(
      screen.getByText(/fired 4 minutes ago, inside the 10-minute cold-bore gap/)
    ).toBeTruthy();
  });

  it('suggests warm bore when the rifle fired a minute ago', async () => {
    // The store is empty, so an implementation reading it would say "cold"
    // here. The database is the only place that knows.
    jest
      .spyOn(dopeLogRepository, 'getLastFiredAt')
      .mockResolvedValue(new Date(Date.now() - 60_000).toISOString());

    const screen = render();

    await waitFor(() => {
      expect(chosenBarrelState(screen)).toBe('Warm bore');
    });
  });

  it('asks the database, not the in-memory store', async () => {
    const lastFiredAt = jest
      .spyOn(dopeLogRepository, 'getLastFiredAt')
      .mockResolvedValue(undefined);

    render();

    await waitFor(() => {
      expect(lastFiredAt).toHaveBeenCalledWith(1);
    });
  });

  it('keeps "Not recorded" when the shooter chooses it', async () => {
    // The regression: "Not recorded" is a real answer, and it used to be
    // indistinguishable from the untouched default, so the suggestion put
    // "Cold bore" straight back.
    jest.spyOn(dopeLogRepository, 'getLastFiredAt').mockResolvedValue(undefined);

    const screen = render();
    await waitFor(() => {
      expect(screen.getByText(/Suggested because/)).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Not recorded'));

    await waitFor(() => {
      expect(screen.getByText(/Leave it unrecorded if you are not sure/)).toBeTruthy();
    });
    expect(chosenBarrelState(screen)).toBe('Not recorded');
    expect(screen.queryByText(/Suggested because/)).toBeNull();
  });

  it('stops calling the suggestion a suggestion once it has been overruled', async () => {
    jest.spyOn(dopeLogRepository, 'getLastFiredAt').mockResolvedValue(undefined);

    const screen = render();
    await waitFor(() => {
      expect(screen.getByText(/Suggested because/)).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('Warm bore'));

    await waitFor(() => {
      expect(screen.queryByText(/Suggested because/)).toBeNull();
    });
    expect(chosenBarrelState(screen)).toBe('Warm bore');
  });

  it('offers all three answers, so unrecorded stays reachable', async () => {
    jest.spyOn(dopeLogRepository, 'getLastFiredAt').mockResolvedValue(undefined);

    const screen = render();

    await waitFor(() => {
      expect(screen.getByText('Barrel state')).toBeTruthy();
    });
    expect(screen.getByLabelText('Not recorded')).toBeTruthy();
    expect(screen.getByLabelText('Cold bore')).toBeTruthy();
    expect(screen.getByLabelText('Warm bore')).toBeTruthy();
  });
});
