import React from 'react';

import { OutlierList } from '../../src/components/OutlierList';
import { validDopeLog } from '../helpers/fixtures';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { DOPEOutlier } from '../../src/utils/dopeAnalysis';

/**
 * Logged entries that disagree with the rest (#64).
 *
 * `detectOutliers` has existed since the analysis landed and was shown nowhere.
 * A mis-keyed entry skews the curve and the velocity and BC suggestions beside
 * it, so the list says what was logged and what the others imply -- the two
 * numbers a shooter needs to decide whether it was a typo.
 */

const outlier = (over: Partial<DOPEOutlier> = {}): DOPEOutlier => ({
  log: validDopeLog(
    { rifleId: 1, ammoId: 1, environmentId: 1 },
    { id: 7, distance: 600, elevationCorrection: 9.4, timestamp: '2026-09-01T12:00:00Z' }
  ),
  expected: 6.1,
  actual: 9.4,
  score: 8.2,
  ...over,
});

describe('OutlierList', () => {
  it('renders nothing when every entry agrees', () => {
    const { toJSON } = renderWithProviders(<OutlierList outliers={[]} unit="MIL" />);
    expect(toJSON()).toBeNull();
  });

  it('says what was logged and what the other entries imply, in yards and the unit shown', () => {
    const { getByText } = renderWithProviders(<OutlierList outliers={[outlier()]} unit="MIL" />);
    expect(getByText('Entries that disagree')).toBeTruthy();
    expect(getByText(/600 yds/)).toBeTruthy();
    expect(getByText(/logged 9\.4 MIL/)).toBeTruthy();
    expect(getByText(/the other entries imply 6\.1 MIL/)).toBeTruthy();
  });

  it('places a meters entry at its distance in yards', () => {
    const meters = outlier({
      log: validDopeLog(
        { rifleId: 1, ammoId: 1, environmentId: 1 },
        { id: 8, distance: 457.2, distanceUnit: 'meters', elevationCorrection: 9.4 }
      ),
    });
    const { getByText } = renderWithProviders(<OutlierList outliers={[meters]} unit="MIL" />);
    expect(getByText(/500 yds/)).toBeTruthy();
  });

  it('lists every outlier, worst first as given', () => {
    const { getAllByText } = renderWithProviders(
      <OutlierList
        outliers={[
          outlier(),
          outlier({
            log: validDopeLog(
              { rifleId: 1, ammoId: 1, environmentId: 1 },
              { id: 9, distance: 300, elevationCorrection: 0.2 }
            ),
            expected: 2.4,
            actual: 0.2,
            score: 4.1,
          }),
        ]}
        unit="MIL"
      />
    );
    const rows = getAllByText(/the other entries imply/);
    expect(rows).toHaveLength(2);
    expect(rows[0].props.children).toMatch(/600 yds/);
  });
});
