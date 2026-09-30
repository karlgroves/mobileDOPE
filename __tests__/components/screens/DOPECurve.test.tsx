import { fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { Colors } from '../../../src/constants/colors';
import { AmmoProfile } from '../../../src/models/AmmoProfile';
import { DOPELog } from '../../../src/models/DOPELog';
import { EnvironmentSnapshot } from '../../../src/models/EnvironmentSnapshot';
import { RifleProfile } from '../../../src/models/RifleProfile';
import { DOPECurve } from '../../../src/screens/DOPECurve';
import { environmentRepository } from '../../../src/services/database';
import { useAppStore } from '../../../src/store';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useDOPEStore } from '../../../src/store/useDOPEStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { confidenceOpacity } from '../../../src/utils/chartConfidence';
import { calculateConfidence } from '../../../src/utils/dopeAnalysis';
import { predictElevation } from '../../../src/utils/solverInputs';
import { contrastRatio } from '../../helpers/contrast';
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
jest.mock('../../../src/utils/solverInputs', () => {
  const standIn = (
    yards: number,
    env: { temperature: number } | undefined,
    unit: 'MIL' | 'MOA'
  ) => {
    const mil = (yards / 100) * (1 + (59 - (env?.temperature ?? 59)) / 200);
    return unit === 'MIL' ? mil : mil * 3.438;
  };
  return {
    ...jest.requireActual('../../../src/utils/solverInputs'),
    predictElevation: (
      _rifle: unknown,
      _ammo: unknown,
      yards: number,
      env: { temperature: number } | undefined,
      unit: 'MIL' | 'MOA'
    ) => standIn(yards, env, unit),
    elevationTable:
      (
        _rifle: unknown,
        _ammo: unknown,
        env: { temperature: number } | undefined,
        maxYards: number,
        unit: 'MIL' | 'MOA'
      ) =>
      (yards: number) => (yards > maxYards ? undefined : standIn(yards, env, unit)),
  };
});

/**
 * The chart is Skia, which cannot draw here. The stand-in runs the chart's
 * render callback with one point per datum -- enough to see which distances get
 * a marker and how each marker is drawn -- and records what was drawn.
 */
const mockDrawn: {
  lines: Record<string, unknown>[];
  circles: Record<string, unknown>[];
  axisOptions?: Record<string, unknown>;
} = {
  lines: [],
  circles: [],
};
jest.mock('victory-native', () => {
  const mockChart = ({
    data,
    xKey,
    yKeys,
    axisOptions,
    children,
  }: {
    data: Record<string, number | undefined>[];
    xKey: string;
    yKeys: string[];
    axisOptions?: Record<string, unknown>;
    children: (arg: { points: Record<string, unknown[]> }) => React.ReactNode;
  }) => {
    mockDrawn.axisOptions = axisOptions;
    const points = Object.fromEntries(
      yKeys.map((key) => [
        key,
        data.map((d) => ({ x: d[xKey], xValue: d[xKey], y: d[key], yValue: d[key] })),
      ])
    );
    return children({ points });
  };
  const mockLine = (props: Record<string, unknown>) => {
    mockDrawn.lines.push(props);
    return null;
  };
  return { CartesianChart: mockChart, Line: mockLine };
});
jest.mock('@shopify/react-native-skia', () => {
  const mockCircle = (props: Record<string, unknown>) => {
    mockDrawn.circles.push(props);
    return null;
  };
  // A stand-in font: what matters is that the chart is given one at all.
  const mockMatchFont = (style: Record<string, unknown>) => ({ mockFont: true, ...style });
  return { Circle: mockCircle, matchFont: mockMatchFont };
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
    // Every log's snapshot exists and is a standard day, unless a test says otherwise.
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => new EnvironmentSnapshot({ ...validEnvironment(), id }));
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

  it('leaves out a log whose snapshot is gone, and says so', async () => {
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) =>
        id === 404 ? null : new EnvironmentSnapshot({ ...validEnvironment(), id })
      );
    seed([...logsAt([300, 500, 700], 0.5), ...logsAt([900], 3, standard, 404)]);
    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);

    expect(await findByText(/1 log has no recorded conditions and was not used/)).toBeTruthy();
  });

  it('shows no suggestion until the snapshots have loaded', async () => {
    // Before they arrive every log would look unconditioned; the card waits
    // rather than flash "not used" at the shooter.
    jest.spyOn(environmentRepository, 'getById').mockReturnValue(new Promise(() => {}));
    seed(logsAt([300, 500, 700], 0.5));
    const { findByText, queryByText } = renderWithProviders(
      <DOPECurve route={route} navigation={navigation} />
    );

    expect(await findByText('Elevation Drop Curve')).toBeTruthy();
    expect(queryByText('Solver inputs')).toBeNull();
  });

  it('reports every log as unused when the snapshots cannot be read', async () => {
    // A failed load must not fall back to guessing a standard day for all of them.
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(environmentRepository, 'getById').mockRejectedValue(new Error('disk'));
    seed(logsAt([300, 500, 700], 0.5));
    const { findByText, queryByText } = renderWithProviders(
      <DOPECurve route={route} navigation={navigation} />
    );

    expect(await findByText(/3 logs have no recorded conditions and were not used/)).toBeTruthy();
    expect(queryByText(/fps$/)).toBeNull();
    error.mockRestore();
  });
});

describe('DOPECurve: distances in yards (#123)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => new EnvironmentSnapshot({ ...validEnvironment(), id }));
  });

  it('plots a meters log at its distance in yards', async () => {
    // 457.2 m is 500 yd. Read raw, it sat at "457.2" -- more than 25 yd from
    // any table row, so its row showed "-", and the summary said 457.2.
    const meters = new DOPELog({
      id: 1,
      rifleId: 1,
      ammoId: 1,
      environmentId: 5,
      distance: 457.2,
      distanceUnit: 'meters',
      elevationCorrection: 4.8,
      windageCorrection: 0,
      correctionUnit: 'MIL',
      targetType: 'steel',
    });
    seed([meters]);
    const { findAllByText, getByText, getAllByText } = renderWithProviders(
      <DOPECurve route={route} navigation={navigation} />
    );

    // The table is the only place a logged value is printed, and a table row
    // only prints one when a log is within 25 yd of it -- so this is the 500 yd
    // row matching.
    await findAllByText('500 yds');
    expect(getByText('4.8')).toBeTruthy();
    // The table row plus the summary's min and max, all in yards and labelled
    // the same way.
    expect(getAllByText('500 yds')).toHaveLength(3);
  });
});

describe('DOPECurve: entries that disagree (#64)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => new EnvironmentSnapshot({ ...validEnvironment(), id }));
  });

  it('lists an entry that sits well off the trend', async () => {
    const wild = logsAt([600], 6)[0];
    seed([...logsAt([300, 400, 500, 700, 800], 0), new DOPELog({ ...wild.toJSON(), id: 99 })]);
    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);

    expect(await findByText('Entries that disagree')).toBeTruthy();
    expect(await findByText(/^600 yds: logged 12\.0 MIL/)).toBeTruthy();
  });

  it('shows nothing when every entry agrees', async () => {
    seed(logsAt([300, 400, 500, 600, 700], 0));
    const { findByText, queryByText } = renderWithProviders(
      <DOPECurve route={route} navigation={navigation} />
    );

    await findByText('Elevation Drop Curve');
    expect(queryByText('Entries that disagree')).toBeNull();
  });
});

describe('DOPECurve: logged drop curve and confidence (#64)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDrawn.lines.length = 0;
    mockDrawn.circles.length = 0;
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => new EnvironmentSnapshot({ ...validEnvironment(), id }));
  });

  /** A well-evidenced log at 300 yd and a thin one at 600 yd. */
  const solidAndThin = () => {
    const [at300, at600] = logsAt([300, 600], 0);
    return [
      new DOPELog({ ...at300.toJSON(), shotCount: 5, hitCount: 5, groupSize: 1.5 }),
      new DOPELog({ ...at600.toJSON(), shotCount: 1 }),
    ];
  };

  /** The filled markers. The stand-in chart puts each point's x at its distance. */
  const fills = () => mockDrawn.circles.filter((c) => c.style !== 'stroke');

  it('draws a line through the logged points, separate from the calculated one', async () => {
    seed(logsAt([300, 500, 700], 0.5));
    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);
    await findByText('Elevation Drop Curve');

    // The calculated curve has a value at every distance; the logged one only
    // where something was logged.
    const logged = mockDrawn.lines.find((l) =>
      (l.points as { yValue?: number }[]).some((p) => p.yValue === undefined)
    );
    expect(logged).toBeDefined();
    const drawnAt = (logged?.points as { xValue: number; yValue?: number }[])
      .filter((p) => p.yValue !== undefined)
      .map((p) => p.xValue);
    expect(drawnAt).toEqual([300, 500, 700]);
    // Gaps between logged distances are bridged, not left as breaks.
    expect(logged?.connectMissingData).toBe(true);
  });

  it('marks each logged distance with opacity from its confidence', async () => {
    const logs = solidAndThin();
    seed(logs);
    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);
    await findByText('Elevation Drop Curve');

    const byDistance = new Map(fills().map((c) => [c.cx, c.opacity as number]));
    expect([...byDistance.keys()]).toEqual([300, 600]);
    expect(byDistance.get(300)).toBeCloseTo(
      confidenceOpacity(calculateConfidence(logs[0]).score),
      10
    );
    expect(byDistance.get(600)).toBeCloseTo(
      confidenceOpacity(calculateConfidence(logs[1]).score),
      10
    );
    expect(byDistance.get(300)).toBeGreaterThan(byDistance.get(600) as number);
  });

  it('outlines every marker at full opacity, so a faint one is still findable', async () => {
    seed(solidAndThin());
    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);
    await findByText('Elevation Drop Curve');

    const outlines = mockDrawn.circles.filter((c) => c.style === 'stroke');
    expect(outlines).toHaveLength(2);
    for (const outline of outlines) {
      expect(outline.opacity ?? 1).toBe(1);
    }
  });

  it('describes every logged point and its confidence to a screen reader', async () => {
    seed(solidAndThin());
    const { findByLabelText } = renderWithProviders(
      <DOPECurve route={route} navigation={navigation} />
    );

    const chart = await findByLabelText(/^Elevation drop curve/);
    const label = chart.props.accessibilityLabel as string;
    expect(label).toMatch(/300 yards, 3\.0 MIL, 1 log, strong confidence/);
    expect(label).toMatch(/600 yards, 6\.0 MIL, 1 log, weak confidence/);
  });
});

describe('DOPECurve: reading values off the chart (#64)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDrawn.axisOptions = undefined;
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => new EnvironmentSnapshot({ ...validEnvironment(), id }));
  });

  it('gives the axes a font, so their numbers are drawn', async () => {
    // With font: null, victory-native draws the grid and no tick labels at all
    // -- seen on the iOS Simulator: no distances, no MIL values.
    seed(logsAt([300, 500], 0));
    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);
    await findByText('Elevation Drop Curve');

    expect(mockDrawn.axisOptions?.font).toEqual(expect.objectContaining({ mockFont: true }));
  });

  it('names the axes and their units, following the unit toggle', async () => {
    seed(logsAt([300, 500], 0));
    const { findByText, getByText } = renderWithProviders(
      <DOPECurve route={route} navigation={navigation} />
    );

    expect(await findByText('Elevation (MIL) by distance (yards)')).toBeTruthy();
    fireEvent.press(getByText('MOA'));
    expect(await findByText('Elevation (MOA) by distance (yards)')).toBeTruthy();
  });

  it('labels the elevation axis without a -0.0', async () => {
    // The solver returns a hair below zero at the zero range; toFixed kept the sign.
    seed(logsAt([300], 0));
    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);
    await findByText('Elevation Drop Curve');

    const format = mockDrawn.axisOptions?.formatYLabel as (v: number) => string;
    expect(format(-0.0001)).toBe('0.0');
  });
});

describe('DOPECurve: the chart can be seen in every theme (#64)', () => {
  /**
   * WCAG 1.4.11: a graphical object needed to understand the content needs
   * 3:1 against what it sits on. Seen on the iOS Simulator in the light theme:
   * the calculated line (#4CAF50) is 2.78:1 on white and the logged line and
   * marker outlines (#FF9800) 2.16:1. The faint marker fill is faint on
   * purpose; the outline is what has to be found.
   */
  const MODES = ['dark', 'light', 'nightVision'] as const;

  afterEach(() => {
    useAppStore.setState((s) => ({ settings: { ...s.settings, themeMode: 'dark' } }));
  });

  it.each(MODES)('draws every line and outline at 3:1 or better in %s', async (mode) => {
    useAppStore.setState((s) => ({ settings: { ...s.settings, themeMode: mode } }));
    jest
      .spyOn(environmentRepository, 'getById')
      .mockImplementation(async (id) => new EnvironmentSnapshot({ ...validEnvironment(), id }));
    mockDrawn.lines.length = 0;
    mockDrawn.circles.length = 0;
    seed(logsAt([300, 500], 0));

    const { findByText } = renderWithProviders(<DOPECurve route={route} navigation={navigation} />);
    await findByText('Elevation Drop Curve');

    const background = Colors[mode].background;
    const strokes = [
      ...mockDrawn.lines.map((l) => l.color as string),
      ...mockDrawn.circles.filter((c) => c.style === 'stroke').map((c) => c.color as string),
    ];
    expect(strokes.length).toBeGreaterThanOrEqual(3);
    for (const color of strokes) {
      expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(3);
    }
  });
});
