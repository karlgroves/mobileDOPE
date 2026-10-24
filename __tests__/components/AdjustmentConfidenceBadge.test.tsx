import React from 'react';

import { AdjustmentConfidenceBadge } from '../../src/components/AdjustmentConfidenceBadge';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { AdjustmentConfidence } from '../../src/utils/adjustmentConfidence';

/**
 * The adjustment confidence badge (#161).
 *
 * The arithmetic is tested in `__tests__/unit/adjustmentConfidence.test.ts`.
 * These are the display decisions: that it reads in the same visual language as
 * the per-log badge #112 shows, that the reasons reach the screen rather than
 * being summarised into a bare number, that the solver-only state is visible as
 * words and not only as a short bar, and that the whole thing reaches a screen
 * reader as one sentence.
 */

const confidence = (over: Partial<AdjustmentConfidence> = {}): AdjustmentConfidence => ({
  score: 0.82,
  factors: { evidence: 0.75, quality: 0.85, agreement: 1, proximity: 1 },
  contributingLogs: 6,
  reasons: ['6 logs agreeing within 0.01 MIL'],
  spread: 0.01,
  nearestLogYards: 0,
  ...over,
});

describe('what the badge shows', () => {
  it('shows the band and the percentage, as the per-log badge does', () => {
    const { getByText } = renderWithProviders(
      <AdjustmentConfidenceBadge confidence={confidence({ score: 0.82 })} />
    );

    expect(getByText('Strong')).toBeTruthy();
    expect(getByText('82%')).toBeTruthy();
  });

  it('bands on the same thresholds as the per-log badge, not its own', () => {
    const { getByText: weak } = renderWithProviders(
      <AdjustmentConfidenceBadge confidence={confidence({ score: 0.44 })} />
    );
    expect(weak('Weak')).toBeTruthy();

    const { getByText: moderate } = renderWithProviders(
      <AdjustmentConfidenceBadge confidence={confidence({ score: 0.45 })} />
    );
    expect(moderate('Moderate')).toBeTruthy();
  });

  it('shows every reason, which is the part the shooter can act on', () => {
    const { getByText } = renderWithProviders(
      <AdjustmentConfidenceBadge
        confidence={confidence({
          score: 0.3,
          reasons: ['Logs disagree by 0.41 MIL', 'Nearest log is 38 yd away'],
        })}
      />
    );

    expect(getByText('Logs disagree by 0.41 MIL')).toBeTruthy();
    expect(getByText('Nearest log is 38 yd away')).toBeTruthy();
  });
});

describe('when the figure was too low to apply', () => {
  it('says so in words beside the band, not only by a short bar (WCAG 1.4.1)', () => {
    const { getByText } = renderWithProviders(
      <AdjustmentConfidenceBadge confidence={confidence({ score: 0.21 })} solverOnly={true} />
    );

    expect(getByText('Weak — not applied')).toBeTruthy();
  });

  it('says nothing of the sort when the adjustment was applied', () => {
    const { getByText, queryByText } = renderWithProviders(
      <AdjustmentConfidenceBadge confidence={confidence()} solverOnly={false} />
    );

    expect(getByText('Strong')).toBeTruthy();
    expect(queryByText(/not applied/)).toBeNull();
  });
});

describe('what a screen reader gets', () => {
  it('reads as one sentence rather than a word, a number and some fragments', () => {
    const { getByTestId } = renderWithProviders(
      <AdjustmentConfidenceBadge
        confidence={confidence({ score: 0.82, reasons: ['6 logs agreeing within 0.01 MIL'] })}
        testID="badge"
      />
    );

    expect(getByTestId('badge').props.accessibilityLabel).toBe(
      'Adjustment confidence Strong, 82 percent. 6 logs agreeing within 0.01 MIL'
    );
  });

  it('states the solver-only fallback first, since it changes what to dial', () => {
    const { getByTestId } = renderWithProviders(
      <AdjustmentConfidenceBadge
        confidence={confidence({ score: 0.2, reasons: ['Logs disagree by 0.41 MIL'] })}
        solverOnly={true}
        testID="badge"
      />
    );

    expect(getByTestId('badge').props.accessibilityLabel).toBe(
      'Adjustment confidence Weak, 20 percent. Too low to apply; showing the solver alone. ' +
        'Logs disagree by 0.41 MIL'
    );
  });

  it('hides the bar from the screen reader, because the label already carries it', () => {
    const { getByTestId } = renderWithProviders(
      <AdjustmentConfidenceBadge confidence={confidence()} testID="badge" />
    );

    // The badge is one accessible element; nothing inside it should be walked
    // separately, which is what `accessible` on the container asserts.
    expect(getByTestId('badge').props.accessible).toBe(true);
  });
});
