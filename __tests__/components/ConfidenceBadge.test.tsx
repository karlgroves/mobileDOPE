import React from 'react';

import { ConfidenceBadge, confidenceBand } from '../../src/components/ConfidenceBadge';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { DOPELogData } from '../../src/models/DOPELog';
import type { DOPEConfidence } from '../../src/utils/dopeAnalysis';

/**
 * The confidence badge (#64).
 *
 * `calculateConfidence` has been tested since it was written; what was missing
 * was anything rendering it, so a shooter could not see it. These tests are
 * about the display decisions, not the arithmetic: which band a score lands in,
 * that the reasons are shown rather than summarised away, and that the whole
 * badge reads as one thing to a screen reader instead of a number, a word and a
 * list of fragments.
 */

const log = {} as DOPELogData;

const confidence = (score: number, reasons: string[] = []): DOPEConfidence => ({
  log,
  score,
  reasons,
});

describe('confidenceBand', () => {
  it('names the three bands at their boundaries', () => {
    // Boundaries rather than midpoints: a band that shifts by one point is a
    // change in what the app tells the shooter, and midpoints would not notice.
    expect(confidenceBand(0.7)).toBe('Strong');
    expect(confidenceBand(0.69)).toBe('Moderate');
    expect(confidenceBand(0.45)).toBe('Moderate');
    expect(confidenceBand(0.44)).toBe('Weak');
  });

  it('handles the ends of the range', () => {
    expect(confidenceBand(1)).toBe('Strong');
    expect(confidenceBand(0)).toBe('Weak');
  });
});

describe('what the badge shows', () => {
  it('shows the band and the percentage', () => {
    const { getByText } = renderWithProviders(<ConfidenceBadge confidence={confidence(0.85)} />);

    expect(getByText('Strong')).toBeTruthy();
    expect(getByText('85%')).toBeTruthy();
  });

  it('lists every reason rather than summarising them away', () => {
    // The reasons are the part a shooter can act on. "only 1 shot" tells them to
    // go and shoot it again; a bare number does not.
    const { getByText } = renderWithProviders(
      <ConfidenceBadge confidence={confidence(0.4, ['only 1 shot', '40% hits'])} />
    );

    expect(getByText('only 1 shot')).toBeTruthy();
    expect(getByText('40% hits')).toBeTruthy();
  });

  it('renders with no reasons at all', () => {
    const { getByText } = renderWithProviders(<ConfidenceBadge confidence={confidence(0.5)} />);

    expect(getByText('Moderate')).toBeTruthy();
  });

  it('rounds the percentage rather than printing a float', () => {
    const { getByText } = renderWithProviders(<ConfidenceBadge confidence={confidence(0.666)} />);

    expect(getByText('67%')).toBeTruthy();
  });
});

describe('how it reads to a screen reader', () => {
  it('presents the whole badge as one label', () => {
    // Otherwise a screen reader walks a word, a number and a list of fragments
    // as separate nodes, and none of them means anything alone. ADR-009 puts
    // the real verification on a device; this is the part code can get right.
    const { getByTestId } = renderWithProviders(
      <ConfidenceBadge confidence={confidence(0.85, ['5-shot group', '90% hits'])} testID="badge" />
    );
    const badge = getByTestId('badge');

    expect(badge.props.accessible).toBe(true);
    expect(badge.props.accessibilityLabel).toBe(
      'Confidence Strong, 85 percent. 5-shot group. 90% hits'
    );
  });

  it('says what the score means, not just what it is', () => {
    const { getByTestId } = renderWithProviders(
      <ConfidenceBadge confidence={confidence(0.5)} testID="badge" />
    );

    expect(getByTestId('badge').props.accessibilityHint).toMatch(/shot count/);
  });
});
