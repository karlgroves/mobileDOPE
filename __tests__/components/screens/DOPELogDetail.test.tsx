import React from 'react';

import { DOPELog } from '../../../src/models/DOPELog';
import { DOPELogDetail } from '../../../src/screens/DOPELogDetail';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { renderWithProviders } from '../../helpers/renderWithProviders';

import type { DOPELogData } from '../../../src/models/DOPELog';

/**
 * The confidence rating is actually on screen (#64).
 *
 * `calculateConfidence` and `ConfidenceBadge` were each tested before this, and
 * both passed, while no screen rendered either -- the feature existed and was
 * unreachable. That gap is what this test closes, and it is the only thing here
 * worth testing at the screen level: the arithmetic and the presentation are
 * covered next door.
 *
 * The stores are real zustand stores, so they are seeded through `setState`
 * rather than mocked. A mock would assert that the screen calls a function; this
 * asserts what a shooter sees.
 */

const log = (over: Partial<DOPELogData> = {}): DOPELogData =>
  ({
    id: 7,
    rifleId: 1,
    ammoId: 1,
    environmentId: 1,
    distance: 500,
    distanceUnit: 'yards',
    elevationCorrection: 3.1,
    windageCorrection: 0.4,
    correctionUnit: 'MIL',
    targetType: 'steel',
    timestamp: '2026-09-01T00:00:00.000Z',
    ...over,
  }) as DOPELogData;

/** The screen's navigation prop, narrowed to what it actually calls. */
const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
} as unknown as Parameters<typeof DOPELogDetail>[0]['navigation'];

const route = (logId: number) =>
  ({ params: { logId }, key: 'k', name: 'DOPELogDetail' }) as unknown as Parameters<
    typeof DOPELogDetail
  >[0]['route'];

const seed = (entry: DOPELogData): void => {
  // The store holds model instances, not plain rows, so the fixture goes through
  // the real constructor. Casting it away would let the screen be tested against
  // a shape the app never actually produces.
  useDOPEStore.setState({ dopeLogs: [new DOPELog(entry)] });
  useRifleStore.setState({ rifles: [{ id: 1, name: 'Tikka T3x' }] as never });
  useAmmoStore.setState({ ammoProfiles: [{ id: 1, name: 'Federal 175' }] as never });
};

describe('DOPELogDetail shows how well-evidenced the entry is', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the confidence badge for a log that exists', () => {
    seed(log({ shotCount: 5, hitCount: 5, groupSize: 2.5 }));

    const { getByTestId, getByText } = renderWithProviders(
      <DOPELogDetail route={route(7)} navigation={navigation} />
    );

    expect(getByText('Confidence in this entry')).toBeTruthy();
    expect(getByTestId('dope-confidence')).toBeTruthy();
  });

  it('shows the reasons the score was given, not just the score', () => {
    // A five-shot group with every shot on target is the case a shooter should
    // be told to trust. The reasons are what make that actionable.
    seed(log({ shotCount: 5, hitCount: 5, groupSize: 2.5 }));

    const { getByTestId } = renderWithProviders(
      <DOPELogDetail route={route(7)} navigation={navigation} />
    );

    expect(getByTestId('dope-confidence').props.accessibilityLabel).toMatch(/5-shot group/);
  });

  it('rates a single unrecorded-outcome shot lower than a clean five-shot group', () => {
    // The end-to-end assertion: a different log produces a different rating on
    // screen. Without this the badge could render a constant and still pass.
    seed(log({ shotCount: 1 }));
    const weak = renderWithProviders(
      <DOPELogDetail route={route(7)} navigation={navigation} />
    ).getByTestId('dope-confidence').props.accessibilityLabel as string;

    seed(log({ shotCount: 5, hitCount: 5, groupSize: 2.5 }));
    const strong = renderWithProviders(
      <DOPELogDetail route={route(7)} navigation={navigation} />
    ).getByTestId('dope-confidence').props.accessibilityLabel as string;

    const percent = (label: string): number => Number(/(\d+) percent/.exec(label)?.[1]);

    expect(percent(weak)).toBeLessThan(percent(strong));
  });

  it('does not render a badge when the log is missing', () => {
    useDOPEStore.setState({ dopeLogs: [] });

    const { queryByTestId } = renderWithProviders(
      <DOPELogDetail route={route(999)} navigation={navigation} />
    );

    expect(queryByTestId('dope-confidence')).toBeNull();
  });
});
