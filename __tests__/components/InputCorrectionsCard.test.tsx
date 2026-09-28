import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { InputCorrectionsCard } from '../../src/components/InputCorrectionsCard';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { InputCorrections } from '../../src/utils/inputCorrections';

/**
 * The muzzle-velocity and BC suggestions on the DOPE curve (#64).
 *
 * The card never changes a profile itself: Apply reports which input and what
 * value, and the screen confirms with the shooter before writing anything.
 */

const base: Omit<InputCorrections, 'status'> = {
  comparisons: [],
  distanceCount: 4,
  spanYards: 600,
};

const suggests: InputCorrections = {
  ...base,
  status: 'suggests',
  muzzleVelocity: {
    current: 2700,
    suggested: 2650,
    confidence: 0.62,
    rationale: 'Logged corrections sit above the prediction.',
  },
  ballisticCoefficient: {
    current: 0.258,
    suggested: 0.249,
    confidence: 0.4,
    rationale: 'The gap widens with distance.',
    dragModel: 'G7',
  },
};

describe('InputCorrectionsCard', () => {
  it('says what data is still needed when there is not enough', () => {
    const { getByText } = renderWithProviders(
      <InputCorrectionsCard
        corrections={{ ...base, status: 'insufficient', distanceCount: 2, spanYards: 300 }}
        onApply={() => {}}
      />
    );
    expect(getByText(/3 or more distances/)).toBeTruthy();
    expect(getByText(/So far: 2 distances/)).toBeTruthy();
  });

  it('says the logs agree when there is nothing to change', () => {
    const { getByText, queryByRole } = renderWithProviders(
      <InputCorrectionsCard corrections={{ ...base, status: 'agrees' }} onApply={() => {}} />
    );
    expect(getByText(/agrees with the solver/)).toBeTruthy();
    expect(queryByRole('button')).toBeNull();
  });

  it('shows each suggestion with its current and suggested value, confidence and reason', () => {
    const { getByText } = renderWithProviders(
      <InputCorrectionsCard corrections={suggests} onApply={() => {}} />
    );
    expect(getByText('2700 → 2650 fps')).toBeTruthy();
    expect(getByText('0.258 → 0.249')).toBeTruthy();
    expect(getByText('G7 BC')).toBeTruthy();
    expect(getByText('Confidence 62%')).toBeTruthy();
    expect(getByText('Logged corrections sit above the prediction.')).toBeTruthy();
  });

  it('does not say the BC check needs more data when it has produced a suggestion', () => {
    const { queryByText } = renderWithProviders(
      <InputCorrectionsCard corrections={{ ...suggests, distanceCount: 3 }} onApply={() => {}} />
    );
    expect(queryByText(/BC check needs/)).toBeNull();
  });

  it('reports which input and value Apply is for', () => {
    const onApply = jest.fn();
    const { getByRole } = renderWithProviders(
      <InputCorrectionsCard corrections={suggests} onApply={onApply} />
    );

    fireEvent.press(getByRole('button', { name: /Use 2650 fps/ }));
    expect(onApply).toHaveBeenLastCalledWith('muzzleVelocity', 2650);

    fireEvent.press(getByRole('button', { name: /Use G7 BC 0.249/ }));
    expect(onApply).toHaveBeenLastCalledWith('ballisticCoefficient', 0.249);
  });

  it('notes the BC check needs a wider spread when only velocity is suggested', () => {
    const { getByText } = renderWithProviders(
      <InputCorrectionsCard
        corrections={{
          ...suggests,
          distanceCount: 3,
          spanYards: 200,
          ballisticCoefficient: undefined,
        }}
        onApply={() => {}}
      />
    );
    expect(getByText(/BC check needs 4 or more distances across 300 yards/)).toBeTruthy();
  });
});
