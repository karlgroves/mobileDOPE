import React from 'react';

import { DopeCoverage } from '../../src/components/DopeCoverage';
import { COVERAGE_TOLERANCE_YARDS } from '../../src/utils/offsetInterpolation';
import { renderWithProviders } from '../helpers/renderWithProviders';

/**
 * The distance-coverage summary on the DOPE Curve (#162).
 *
 * The gap arithmetic is covered in `offsetInterpolation.test.ts`. What is
 * asserted here is the part that makes it useful: that the missing distances
 * are named rather than counted, that "no gaps" is said out loud instead of
 * leaving an empty space the shooter has to interpret, and that the whole thing
 * reaches a screen reader as one sentence.
 */

const at = (distance: number) => ({ distance });

describe('what the coverage summary says', () => {
  it('names the distances that have DOPE', () => {
    const { getByText } = renderWithProviders(
      <DopeCoverage points={[at(100), at(300), at(600)]} />
    );

    expect(getByText('You have DOPE at 100, 300 and 600 yd.')).toBeTruthy();
  });

  it('names the gaps worth practising, with their bounds', () => {
    // 100→300 is 200 yards, wider than the tolerance; 300→400 is not.
    const { getByText } = renderWithProviders(
      <DopeCoverage points={[at(100), at(300), at(400)]} />
    );

    expect(getByText('Worth practising: 100–300 yd.')).toBeTruthy();
  });

  it('says so explicitly when there are no gaps, rather than showing nothing', () => {
    const { getByText } = renderWithProviders(
      <DopeCoverage points={[at(100), at(200), at(300)]} />
    );

    expect(getByText(/No gaps worth filling/)).toBeTruthy();
  });

  it('handles a single logged distance without inventing a range', () => {
    const { getByText } = renderWithProviders(<DopeCoverage points={[at(500)]} />);

    expect(getByText('You have DOPE at 500 yd.')).toBeTruthy();
    expect(getByText(/No gaps worth filling/)).toBeTruthy();
  });

  it('renders nothing at all when there is no DOPE to describe', () => {
    const { queryByTestId } = renderWithProviders(<DopeCoverage points={[]} testID="coverage" />);

    expect(queryByTestId('coverage')).toBeNull();
  });

  it('sorts and deduplicates the distances it was handed', () => {
    const { getByText } = renderWithProviders(
      <DopeCoverage points={[at(600), at(100), at(600), at(300)]} />
    );

    expect(getByText('You have DOPE at 100, 300 and 600 yd.')).toBeTruthy();
  });

  it('uses a tolerance wide enough that adjacent range distances are not flagged', () => {
    // A shooter logging every 100 yards has usable coverage; flagging each of
    // those as a gap would make the whole section noise.
    expect(COVERAGE_TOLERANCE_YARDS).toBeGreaterThan(100);
  });
});

describe('what a screen reader gets', () => {
  it('reads as one sentence covering both halves', () => {
    const { getByTestId } = renderWithProviders(
      <DopeCoverage points={[at(100), at(300), at(400)]} testID="coverage" />
    );

    expect(getByTestId('coverage').props.accessibilityLabel).toBe(
      'You have DOPE at 100, 300 and 400 yd. Worth practising: 100–300 yd.'
    );
  });

  it('is one accessible element, not three walked separately', () => {
    const { getByTestId } = renderWithProviders(
      <DopeCoverage points={[at(500)]} testID="coverage" />
    );

    expect(getByTestId('coverage').props.accessible).toBe(true);
  });
});
