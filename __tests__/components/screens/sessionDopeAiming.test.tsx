import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { DOPELog } from '../../../src/models/DOPELog';
import { RangeSessionActive } from '../../../src/screens/RangeSessionActive';
import { environmentRepository } from '../../../src/services/database';
import { rangeSessionRepository } from '../../../src/services/database/RangeSessionRepository';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useAppStore } from '../../../src/store/useAppStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { DOPELogData } from '../../../src/models/DOPELog';
import type { AlertButton } from 'react-native';

/**
 * DOPE-assisted aiming in range session mode (#166), the barrel-state card
 * (#165), and the shot number session logging supplies (#164).
 *
 * The three land together because they are one change to one screen: the
 * recommendation, the corrections offered beside it, and the logging path that
 * makes the next recommendation move. Splitting them would mean three branches
 * rewriting the same four hundred lines.
 *
 * `useDopeAdjustment` is the calculator's own hook, and its arithmetic is
 * covered by `dopeAdjustment.test.ts` and `dopeAdjustedSolution.test.tsx`. What
 * is asserted here is session mode's share: that the hook is actually wired,
 * that the switch returns the solver's figure, that the details break the
 * number down, and that logging a shot moves it.
 */

const rifle = {
  id: 1,
  name: 'Tikka T3x',
  caliber: '.308 Winchester',
  zeroDistance: 100,
  scopeHeight: 1.5,
  twistRate: '1:10',
  barrelLength: 24,
  clickValueType: 'MIL',
  clickValue: 0.1,
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
  windSpeed: 0,
  windDirection: 90,
  timestamp: new Date().toISOString(),
};

const session = (over: Record<string, unknown> = {}) => ({
  id: 42,
  rifleId: 1,
  ammoId: 1,
  environmentId: 1,
  distance: 500,
  shotCount: 0,
  coldBoreShot: true,
  startTime: new Date().toISOString(),
  ...over,
});

/** The fields #161's confidence reads, set to a well-shot group. */
const WELL_EVIDENCED = { shotCount: 5, hitCount: 5, groupSize: 3 };

let nextId = 1;

const log = (over: Partial<DOPELogData> = {}): DOPELog =>
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
    ...WELL_EVIDENCED,
    ...over,
  } as DOPELogData);

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { sessionId: 42 }, key: 'k', name: 'RangeSessionActive' };

const createDopeLog = jest.fn();
const loadDopeLogs = jest.fn();

/** Mounts the session screen over `logs`, with `sessionOver` on the session. */
const mount = async (logs: DOPELog[] = [], sessionOver: Record<string, unknown> = {}) => {
  useRifleStore.setState({ rifles: [rifle] as never });
  useAmmoStore.setState({ ammoProfiles: [ammo] as never });
  useEnvironmentStore.setState({ snapshots: [snapshot] as never, current: snapshot as never });
  useDOPEStore.setState({ dopeLogs: logs, createDopeLog, loadDopeLogs });

  jest
    .spyOn(rangeSessionRepository, 'getById')
    .mockImplementation(() => Promise.resolve(session(sessionOver) as never));

  const view = renderWithProviders(
    <RangeSessionActive navigation={navigation as never} route={route as never} />
  );

  await waitFor(() => expect(view.queryByText('Loading session...')).toBeNull());
  // The ballistic solution is computed in an effect, and the recommendation
  // block and the Log button both depend on it. Without this every assertion
  // below would race the first solve.
  await waitFor(() => expect(view.getByTestId('session-dope-recommendation')).toBeTruthy());
  return view;
};

/** The headline elevation as rendered, to the two places the screen shows. */
const shownElevation = (view: Awaited<ReturnType<typeof mount>>): number =>
  Number(view.getAllByText(/^-?\d+\.\d$/)[0].props.children);

/** The value of one row inside the expanded details, as rendered. */
const detailValue = (view: Awaited<ReturnType<typeof mount>>, testID: string): string =>
  (view.getByTestId(testID).props.children as unknown[]).join('');

/** Presses the alert button whose text is `label`. */
const pressAlertButton = async (label: string) => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const buttons = (calls[calls.length - 1][2] ?? []) as AlertButton[];
  const button = buttons.find((candidate) => candidate.text === label);
  if (!button?.onPress) throw new Error(`No alert button labelled "${label}"`);
  await button.onPress();
};

beforeEach(() => {
  jest.clearAllMocks();
  nextId = 1;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest
    .spyOn(environmentRepository, 'getById')
    .mockImplementation(() => Promise.resolve(snapshot as never));
  createDopeLog.mockImplementation(() => Promise.resolve(log()));
  loadDopeLogs.mockImplementation(() => Promise.resolve());
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, defaultCorrectionUnit: 'MIL' },
  });
});

describe('session mode with no DOPE (#166)', () => {
  it('says it is using the solver alone', async () => {
    const view = await mount([]);

    expect(view.getByTestId('session-dope-caption').props.children).toContain('solver only');
  });

  it('shows no confidence badge, because there is nothing to be confident about', async () => {
    const view = await mount([]);

    expect(view.queryByTestId('session-adjustment-confidence')).toBeNull();
  });
});

describe('session mode with DOPE to rank (#166)', () => {
  it('loads the logs for this rifle and load, which the History tab may never have', async () => {
    await mount([]);

    expect(loadDopeLogs).toHaveBeenCalledWith(1, 1);
  });

  it('says how many logs the recommendation came from', async () => {
    const view = await mount([log(), log(), log()]);

    await waitFor(() =>
      expect(view.getByTestId('session-dope-caption').props.children).toMatch(/Based on \d+ logs?/)
    );
  });

  it('shows the confidence in the recommendation', async () => {
    const view = await mount([log(), log(), log()]);

    await waitFor(() => expect(view.getByTestId('session-adjustment-confidence')).toBeTruthy());
  });

  it('returns the solver’s own figure when the switch is turned off', async () => {
    const view = await mount([log(), log(), log()]);

    await waitFor(() =>
      expect(view.getByTestId('session-dope-caption').props.children).toMatch(/Based on/)
    );
    const adjusted = shownElevation(view);

    fireEvent(view.getByTestId('session-dope-adjust-switch'), 'valueChange', false);

    expect(view.getByTestId('session-dope-caption').props.children).toBe(
      'Adjustment off. Showing the solver alone.'
    );
    expect(shownElevation(view)).not.toBe(adjusted);
  });

  it('breaks the figure down on demand, and not before', async () => {
    const view = await mount([log(), log(), log()]);

    expect(view.queryByTestId('session-dope-details')).toBeNull();

    fireEvent.press(view.getByTestId('session-dope-details-toggle'));

    expect(view.getByTestId('session-dope-details')).toBeTruthy();
    expect(view.getByText('Solver alone')).toBeTruthy();
    expect(view.getByText('From your DOPE')).toBeTruthy();
  });

  it('lists the contributing logs inside the details', async () => {
    const view = await mount([log(), log(), log()]);

    await waitFor(() =>
      expect(view.getByTestId('session-dope-caption').props.children).toMatch(/Based on/)
    );
    fireEvent.press(view.getByTestId('session-dope-details-toggle'));

    expect(view.getByTestId('session-relevant-dope')).toBeTruthy();
  });
});

describe('logging a shot from the session (#164, #166)', () => {
  it('supplies the shot number automatically, which #164 asked for', async () => {
    const view = await mount([], { shotCount: 4 });

    fireEvent.press(view.getByText('Log This Shot to DOPE'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    await pressAlertButton('Log Shot');

    await waitFor(() => expect(createDopeLog).toHaveBeenCalled());
    expect(createDopeLog.mock.calls[0][0].shotNumberInSession).toBe(4);
  });

  it('records shot 1 before the counter has moved', async () => {
    const view = await mount([], { shotCount: 0 });

    fireEvent.press(view.getByText('Log This Shot to DOPE'));
    await pressAlertButton('Log Shot');

    await waitFor(() => expect(createDopeLog).toHaveBeenCalled());
    expect(createDopeLog.mock.calls[0][0].shotNumberInSession).toBe(1);
  });

  it('carries the session’s cold-bore answer onto the first shot only', async () => {
    const first = await mount([], { shotCount: 0, coldBoreShot: true });
    fireEvent.press(first.getByText('Log This Shot to DOPE'));
    await pressAlertButton('Log Shot');
    await waitFor(() => expect(createDopeLog).toHaveBeenCalled());
    expect(createDopeLog.mock.calls[0][0].coldBoreShot).toBe(true);

    createDopeLog.mockClear();
    const later = await mount([], { shotCount: 6, coldBoreShot: true });
    fireEvent.press(later.getByText('Log This Shot to DOPE'));
    await pressAlertButton('Log Shot');
    await waitFor(() => expect(createDopeLog).toHaveBeenCalled());
    expect(createDopeLog.mock.calls[0][0].coldBoreShot).toBe(false);
  });

  it('does not write anything until the shooter confirms', async () => {
    const view = await mount([]);

    fireEvent.press(view.getByText('Log This Shot to DOPE'));

    expect(Alert.alert).toHaveBeenCalled();
    expect(createDopeLog).not.toHaveBeenCalled();
  });

  it('says which figure it stores before storing it', async () => {
    const view = await mount([]);

    fireEvent.press(view.getByText('Log This Shot to DOPE'));

    const message = (Alert.alert as jest.Mock).mock.calls[0][1];
    expect(message).toMatch(/measured against the solver/);
    expect(message).toMatch(/MIL elevation/);
  });

  it('stores the solver’s figure plus the shooter’s own trim, not the adjusted one', async () => {
    // #189's rule: a figure derived from the logs must not be written back,
    // because offsets are measured against the solver. The manual trim is the
    // one thing here that is the shooter's own observation, so it belongs in
    // the log and the DOPE-derived offset does not.
    const view = await mount([log(), log(), log()]);
    await waitFor(() =>
      expect(view.getByTestId('session-dope-caption').props.children).toMatch(/Based on/)
    );

    fireEvent.press(view.getByTestId('session-dope-details-toggle'));
    const solverAlone = Number.parseFloat(detailValue(view, 'session-detail-solver'));

    fireEvent.press(view.getByLabelText('Increase elevation correction, MIL'));
    fireEvent.press(view.getByText('Log This Shot to DOPE'));
    await pressAlertButton('Log Shot');

    await waitFor(() => expect(createDopeLog).toHaveBeenCalled());
    expect(createDopeLog.mock.calls[0][0].elevationCorrection).toBeCloseTo(solverAlone + 0.1, 2);
  });

  it('says the figure has just moved, and clears the trim it folded in', async () => {
    const view = await mount([]);

    expect(view.queryByTestId('session-updated-from-last-shot')).toBeNull();

    fireEvent.press(view.getByLabelText('Increase elevation correction, MIL'));
    fireEvent.press(view.getByText('Log This Shot to DOPE'));
    await pressAlertButton('Log Shot');

    await waitFor(() => expect(view.getByTestId('session-updated-from-last-shot')).toBeTruthy());
  });

  it('stops saying so once the shot is at a different distance', async () => {
    const view = await mount([]);

    fireEvent.press(view.getByText('Log This Shot to DOPE'));
    await pressAlertButton('Log Shot');
    await waitFor(() => expect(view.getByTestId('session-updated-from-last-shot')).toBeTruthy());

    fireEvent.press(view.getByLabelText(/^Target Distance: 500/));
    fireEvent.press(await view.findByLabelText('600 yards'));

    await waitFor(() => expect(view.queryByTestId('session-updated-from-last-shot')).toBeNull());
  });
});

describe('the barrel-state card in session mode (#165)', () => {
  it('is on the screen, saying what it is waiting for', async () => {
    const view = await mount([]);

    expect(view.getByTestId('session-barrel-state')).toBeTruthy();
    expect(view.getByTestId('cold-bore-short')).toBeTruthy();
  });

  it('offers the cold-bore shift once there is enough data, off by default', async () => {
    const view = await mount(
      [
        ...Array.from({ length: 3 }, () =>
          log({ coldBoreShot: true, shotNumberInSession: 1, elevationCorrection: 3.4 })
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          log({ coldBoreShot: false, shotNumberInSession: 2 + i, elevationCorrection: 3.1 })
        ),
      ],
      { shotCount: 0, coldBoreShot: true }
    );

    await waitFor(() => expect(view.getByTestId('apply-cold-bore')).toBeTruthy());
    expect(view.getByTestId('apply-cold-bore').props.value).toBe(false);
    expect(view.getByTestId('cold-bore-caption').props.children).toMatch(
      /Expected cold-bore shift: 0\.30 MIL low/
    );
  });

  it('moves the dialled figure only once the shooter applies it', async () => {
    const view = await mount(
      [
        ...Array.from({ length: 3 }, () =>
          log({ coldBoreShot: true, shotNumberInSession: 1, elevationCorrection: 3.4 })
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          log({ coldBoreShot: false, shotNumberInSession: 2 + i, elevationCorrection: 3.1 })
        ),
      ],
      { shotCount: 0, coldBoreShot: true }
    );

    await waitFor(() => expect(view.getByTestId('apply-cold-bore')).toBeTruthy());
    const before = shownElevation(view);

    fireEvent(view.getByTestId('apply-cold-bore'), 'valueChange', true);

    await waitFor(() => expect(shownElevation(view)).toBeCloseTo(before + 0.3, 1));
  });
});
