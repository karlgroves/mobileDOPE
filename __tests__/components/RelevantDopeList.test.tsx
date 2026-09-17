import React from 'react';

import { RelevantDopeList, daysAgo, describeAge } from '../../src/components/RelevantDopeList';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { Match } from '../../src/utils/dopeMatching';

/**
 * The matches list (#70).
 *
 * `rankMatches` has been tested since it was written and nothing rendered it.
 * These tests cover the display decisions rather than the scoring: that a row
 * reads as one thing, that the age is shown at all, and that the list says
 * something useful when there is nothing to show.
 */

const NOW = new Date('2026-09-17T12:00:00.000Z');

const log = (over: Partial<DOPELogData> = {}): DOPELogData =>
  ({
    id: 1,
    rifleId: 1,
    ammoId: 1,
    environmentId: 1,
    distance: 500,
    distanceUnit: 'yards',
    elevationCorrection: 3.14,
    windageCorrection: 0.42,
    correctionUnit: 'MIL',
    targetType: 'steel',
    timestamp: '2026-09-10T12:00:00.000Z',
    ...over,
  }) as DOPELogData;

const match = (over: Partial<DOPELogData> = {}, score = 0.82): Match<DOPELogData> => ({
  log: log(over),
  score,
  factors: { distance: 1, environment: 0.5, recency: 0.9, quality: 0.5 },
});

describe('daysAgo', () => {
  it('counts whole days back from now', () => {
    expect(daysAgo('2026-09-10T12:00:00.000Z', NOW)).toBe(7);
    expect(daysAgo('2026-09-17T12:00:00.000Z', NOW)).toBe(0);
  });

  it('never returns a negative age for a log dated in the future', () => {
    // Clock skew between devices is real, and "-3 days ago" reads as a bug.
    expect(daysAgo('2026-09-20T12:00:00.000Z', NOW)).toBe(0);
  });

  it('returns undefined rather than NaN for missing or unparseable dates', () => {
    expect(daysAgo(undefined, NOW)).toBeUndefined();
    expect(daysAgo('not a date', NOW)).toBeUndefined();
  });
});

describe('describeAge', () => {
  it('uses words for the recent cases', () => {
    expect(describeAge(0)).toBe('today');
    expect(describeAge(1)).toBe('yesterday');
    expect(describeAge(7)).toBe('7 days ago');
  });

  it('switches to months once days stop being readable', () => {
    expect(describeAge(59)).toBe('59 days ago');
    expect(describeAge(60)).toBe('2 months ago');
  });

  it('says so when a log carries no date', () => {
    // Rather than omitting it, which would read as "recent".
    expect(describeAge(undefined)).toBe('undated');
  });
});

describe('what the list shows', () => {
  // Text is asserted as it composes, not as it is written in JSX: `{distance}`
  // and `{unit}` are two children of one <Text>, so the node reads "500yd".
  // Probed rather than assumed -- the first version of these assertions looked
  // for "500" and found nothing.

  it('shows distance, both corrections, the age and the relevance', () => {
    const { getByText } = renderWithProviders(
      <RelevantDopeList matches={[match()]} now={NOW} testID="list" />
    );

    expect(getByText('500yd')).toBeTruthy();
    expect(getByText('7 days ago')).toBeTruthy();
    expect(getByText('82%')).toBeTruthy();
    // Rounded to one decimal: a turret does not dial 3.14 MIL.
    expect(getByText('3.1 / 0.4 MIL')).toBeTruthy();
  });

  it('labels a metric log in metres', () => {
    const { getByText } = renderWithProviders(
      <RelevantDopeList matches={[match({ distanceUnit: 'meters' })]} now={NOW} />
    );

    expect(getByText('500m')).toBeTruthy();
  });

  it('renders every match, not just the first', () => {
    const matches = [match({ id: 1 }), match({ id: 2, distance: 600 }), match({ id: 3 })];

    const { getByText } = renderWithProviders(
      <RelevantDopeList matches={matches} now={NOW} testID="list" />
    );

    expect(getByText('600yd')).toBeTruthy();
  });

  it('says why the list is empty rather than showing nothing', () => {
    // An empty card reads as a bug. This reads as an answer.
    const { getByTestId } = renderWithProviders(
      <RelevantDopeList matches={[]} now={NOW} testID="list" />
    );

    expect(getByTestId('list').props.children).toMatch(/No logged DOPE/);
  });
});

describe('how a row reads to a screen reader', () => {
  it('presents each row as one label', () => {
    const { getByLabelText } = renderWithProviders(
      <RelevantDopeList matches={[match()]} now={NOW} />
    );

    expect(
      getByLabelText(
        '500 yards: elevation 3.1 MIL, windage 0.4 MIL. Shot 7 days ago. 82 percent relevant.'
      )
    ).toBeTruthy();
  });
});
