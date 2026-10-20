import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { DopeAdjustedElevation } from '../../src/components/DopeAdjustedElevation';
import { NO_DATA_REASON } from '../../src/utils/dopeAssistedElevation';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { DOPELogData } from '../../src/models/DOPELog';
import type {
  DopeAssistedElevation,
  DopeOffsetContribution,
} from '../../src/utils/dopeAssistedElevation';

/**
 * The adjusted elevation beside the solver's own figure (#168).
 *
 * The thing being guarded is that the shooter can always tell which number is
 * which. One of these is what the solver computed and the other is what their
 * own history says; a card that blurs them is worse than no card, because the
 * number gets dialled either way.
 */

const log = (id: number, over: Partial<DOPELogData> = {}): DOPELogData => ({
  id,
  rifleId: 1,
  ammoId: 1,
  environmentId: 1,
  distance: 500,
  distanceUnit: 'yards',
  elevationCorrection: 3.2,
  windageCorrection: 0,
  correctionUnit: 'MIL',
  targetType: 'steel',
  ...over,
});

const contribution = (id: number, offset: number, weight: number): DopeOffsetContribution => ({
  log: log(id),
  distanceYards: 500,
  logged: 3.2,
  predicted: 3.2 - offset,
  offset,
  score: 0.8,
  weight,
});

const adjustment = (over: Partial<DopeAssistedElevation> = {}): DopeAssistedElevation => ({
  unit: 'MIL',
  solverElevation: 3.4,
  adjustedElevation: 3.6,
  offset: 0.2,
  combinedOffset: 0.2,
  appliedShare: 1,
  contributions: [
    contribution(1, 0.2, 0.34),
    contribution(2, 0.2, 0.33),
    contribution(3, 0.2, 0.33),
  ],
  reason: '3 logs support a +0.20 MIL offset; 100% applied',
  ...over,
});

const noData = (): DopeAssistedElevation => ({
  unit: 'MIL',
  solverElevation: 3.4,
  adjustedElevation: 3.4,
  offset: 0,
  combinedOffset: 0,
  appliedShare: 0,
  contributions: [],
  reason: NO_DATA_REASON,
});

describe('DopeAdjustedElevation', () => {
  it('shows the adjusted elevation beside the solver figure, each labelled', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <DopeAdjustedElevation adjustment={adjustment()} enabled onToggle={() => {}} testID="dae" />
    );

    expect(getByTestId('dae-solver').props.children).toContain('3.40');
    expect(getByTestId('dae-adjusted').props.children).toContain('3.60');
    // Labelled in text, not by position or colour alone (WCAG 1.4.1).
    expect(getByText('SOLVER')).toBeTruthy();
    expect(getByText('DOPE-ADJUSTED')).toBeTruthy();
  });

  it('shows the offset and how many logs are behind it', () => {
    const { getByTestId } = renderWithProviders(
      <DopeAdjustedElevation adjustment={adjustment()} enabled onToggle={() => {}} testID="dae" />
    );

    const offset = getByTestId('dae-offset').props.children as string;

    expect(offset).toContain('+0.20');
    expect(offset).toContain('MIL');
    expect(offset).toContain('3 logs');
  });

  it('signs a negative offset rather than leaving the direction to be inferred', () => {
    const { getByTestId } = renderWithProviders(
      <DopeAdjustedElevation
        adjustment={adjustment({
          offset: -0.3,
          combinedOffset: -0.3,
          adjustedElevation: 3.1,
          reason: '3 logs support a -0.30 MIL offset; 100% applied',
        })}
        enabled
        onToggle={() => {}}
        testID="dae"
      />
    );

    expect(getByTestId('dae-offset').props.children as string).toContain('-0.30');
    expect(getByTestId('dae-adjusted').props.children).toContain('3.10');
  });

  it('says "1 log" for a single contributing log', () => {
    const { getByTestId } = renderWithProviders(
      <DopeAdjustedElevation
        adjustment={adjustment({
          contributions: [contribution(1, 0.4, 1)],
          offset: 0.2,
          combinedOffset: 0.4,
          appliedShare: 0.5,
          adjustedElevation: 3.6,
          reason: '1 log supports a +0.40 MIL offset; 50% applied',
        })}
        enabled
        onToggle={() => {}}
        testID="dae"
      />
    );

    const offset = getByTestId('dae-offset').props.children as string;

    expect(offset).toContain('1 log');
    expect(offset).not.toContain('1 logs');
  });

  it('reports in whatever unit the adjustment is in', () => {
    const { getByTestId } = renderWithProviders(
      <DopeAdjustedElevation
        adjustment={adjustment({
          unit: 'MOA',
          solverElevation: 11.69,
          adjustedElevation: 12.38,
          offset: 0.688,
          combinedOffset: 0.688,
          reason: '3 logs support a +0.69 MOA offset; 100% applied',
        })}
        enabled
        onToggle={() => {}}
        testID="dae"
      />
    );

    expect(getByTestId('dae-solver').props.children).toContain('11.69');
    expect(getByTestId('dae-offset').props.children as string).toContain('MOA');
  });

  describe('when the adjustment is switched off', () => {
    it('keeps the solver value visible', () => {
      const { getByTestId } = renderWithProviders(
        <DopeAdjustedElevation
          adjustment={adjustment()}
          enabled={false}
          onToggle={() => {}}
          testID="dae"
        />
      );

      expect(getByTestId('dae-solver').props.children).toContain('3.40');
    });

    it('does not present an adjusted figure as the one to dial', () => {
      // The figure is still shown -- the same precedent the Advanced Corrections
      // card on this screen sets -- but it is stated as not applied, because a
      // second large number next to the first is the one thing a shooter must
      // not have to guess about.
      const { getByTestId, queryByText } = renderWithProviders(
        <DopeAdjustedElevation
          adjustment={adjustment()}
          enabled={false}
          onToggle={() => {}}
          testID="dae"
        />
      );

      expect(queryByText('DOPE-ADJUSTED')).toBeNull();
      expect(getByTestId('dae-status').props.children as string).toMatch(/not applied/i);
      expect(getByTestId('dae-status').props.children as string).toContain('3.60');
    });

    it('still says what the offset would be and from how many logs', () => {
      const { getByTestId } = renderWithProviders(
        <DopeAdjustedElevation
          adjustment={adjustment()}
          enabled={false}
          onToggle={() => {}}
          testID="dae"
        />
      );

      const offset = getByTestId('dae-offset').props.children as string;

      expect(offset).toContain('+0.20');
      expect(offset).toContain('3 logs');
    });
  });

  describe('the switch', () => {
    it('reports the change to the caller', () => {
      const onToggle = jest.fn();
      const { getByTestId } = renderWithProviders(
        <DopeAdjustedElevation adjustment={adjustment()} enabled onToggle={onToggle} testID="dae" />
      );

      fireEvent(getByTestId('dae-switch'), 'valueChange', false);

      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('carries its own label for a screen reader', () => {
      // A bare switch announces "switch, on" and nothing else. The label has to
      // say what it governs, because the control sits next to two numbers that
      // both look dialable.
      const { getByTestId } = renderWithProviders(
        <DopeAdjustedElevation adjustment={adjustment()} enabled onToggle={() => {}} testID="dae" />
      );

      const label = getByTestId('dae-switch').props.accessibilityLabel as string;

      expect(label).toMatch(/DOPE/);
      expect(label).toMatch(/elevation/i);
    });

    it('is disabled when there is nothing to apply', () => {
      // A switch that visibly changes nothing is a bug report waiting to be
      // filed. With no logs behind it there is no adjustment to turn off.
      const { getByTestId } = renderWithProviders(
        <DopeAdjustedElevation adjustment={noData()} enabled onToggle={() => {}} testID="dae" />
      );

      expect(getByTestId('dae-switch').props.disabled).toBe(true);
    });
  });

  describe('with no historical data', () => {
    it("gives the solver's figure and the issue's reason", () => {
      const { getByTestId, queryByText } = renderWithProviders(
        <DopeAdjustedElevation adjustment={noData()} enabled onToggle={() => {}} testID="dae" />
      );

      expect(getByTestId('dae-solver').props.children).toContain('3.40');
      expect(getByTestId('dae-status').props.children).toBe(NO_DATA_REASON);
      expect(queryByText('DOPE-ADJUSTED')).toBeNull();
    });

    it('shows no offset line at all rather than a zero', () => {
      // "+0.00 MIL from 0 logs" reads as a measurement that came out at zero.
      const { queryByTestId } = renderWithProviders(
        <DopeAdjustedElevation adjustment={noData()} enabled onToggle={() => {}} testID="dae" />
      );

      expect(queryByTestId('dae-offset')).toBeNull();
    });
  });

  it('gives a screen reader both numbers and their provenance in one node', () => {
    // One node for the pair, for the same reason RelevantDopeList uses one per
    // row: a reader walking two bare numbers and a percentage separately gives
    // the shooter nothing they can act on.
    const { getByTestId } = renderWithProviders(
      <DopeAdjustedElevation adjustment={adjustment()} enabled onToggle={() => {}} testID="dae" />
    );

    const label = getByTestId('dae-summary').props.accessibilityLabel as string;

    expect(label).toContain('3.40');
    expect(label).toContain('3.60');
    expect(label).toContain('3 logs');
    expect(label).toMatch(/MIL/);
  });
});
