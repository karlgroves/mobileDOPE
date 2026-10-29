import fs from 'fs';
import path from 'path';

import { DEFAULT_CONFIDENCE_THRESHOLD } from '../../src/utils/adjustmentConfidence';
import { DEFAULT_DISTANCE_DELTA } from '../../src/utils/dopeMatching';
import {
  MAX_CONFIDENCE_THRESHOLD,
  MAX_DISTANCE_DELTA_YARDS,
  MIN_CONFIDENCE_THRESHOLD,
  MIN_DISTANCE_DELTA_YARDS,
  isValidConfidenceThreshold,
  isValidDistanceDelta,
  percentToThreshold,
  thresholdPercent,
} from '../../src/utils/dopeSettings';

/**
 * The bounds on the DOPE-assisted aiming settings (#167).
 *
 * These guards exist because a stored value does not only come from the control
 * that produced it -- it can arrive from a previous version, a restored backup,
 * or a corrupted write. And the failure is silent: a matching window of 0
 * matches no log at all, and a confidence threshold above 1 can never be
 * cleared, so in both cases DOPE-assisted aiming switches itself off and the
 * shooter sees a correct-looking solver figure with no explanation.
 */

describe('isValidDistanceDelta (#167)', () => {
  it('accepts the documented range', () => {
    expect(isValidDistanceDelta(MIN_DISTANCE_DELTA_YARDS)).toBe(true);
    expect(isValidDistanceDelta(50)).toBe(true);
    expect(isValidDistanceDelta(MAX_DISTANCE_DELTA_YARDS)).toBe(true);
  });

  it('rejects a window that would match nothing', () => {
    // The quiet failure: zero matches no log, so every shot falls back to the
    // solver with the reason "No historical data".
    expect(isValidDistanceDelta(0)).toBe(false);
    expect(isValidDistanceDelta(-50)).toBe(false);
  });

  it('rejects a window outside the range the screen offers', () => {
    expect(isValidDistanceDelta(MIN_DISTANCE_DELTA_YARDS - 1)).toBe(false);
    expect(isValidDistanceDelta(MAX_DISTANCE_DELTA_YARDS + 1)).toBe(false);
  });

  it('rejects anything that is not a finite number', () => {
    expect(isValidDistanceDelta(Number.NaN)).toBe(false);
    expect(isValidDistanceDelta(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidDistanceDelta('50')).toBe(false);
    expect(isValidDistanceDelta(null)).toBe(false);
    expect(isValidDistanceDelta(undefined)).toBe(false);
  });

  it('accepts the shipped default, which is the matcher’s own', () => {
    // If these two ever disagree, the app ships with a setting it then refuses
    // to load. Pinned rather than assumed.
    expect(isValidDistanceDelta(DEFAULT_DISTANCE_DELTA)).toBe(true);
  });
});

describe('isValidConfidenceThreshold (#167)', () => {
  it('accepts a fraction in [0, 1]', () => {
    expect(isValidConfidenceThreshold(MIN_CONFIDENCE_THRESHOLD)).toBe(true);
    expect(isValidConfidenceThreshold(0.4)).toBe(true);
    expect(isValidConfidenceThreshold(MAX_CONFIDENCE_THRESHOLD)).toBe(true);
  });

  it('rejects a threshold that can never be cleared', () => {
    // Above 1 the adjustment is permanently off, reported as "Confidence too
    // low" -- which reads as a statement about the shooter's logs.
    expect(isValidConfidenceThreshold(1.5)).toBe(false);
    expect(isValidConfidenceThreshold(40)).toBe(false);
  });

  it('rejects a negative threshold', () => {
    expect(isValidConfidenceThreshold(-0.1)).toBe(false);
  });

  it('rejects anything that is not a finite number', () => {
    expect(isValidConfidenceThreshold(Number.NaN)).toBe(false);
    expect(isValidConfidenceThreshold('0.4')).toBe(false);
    expect(isValidConfidenceThreshold(undefined)).toBe(false);
  });

  it('accepts the shipped default, which is #161’s own', () => {
    expect(isValidConfidenceThreshold(DEFAULT_CONFIDENCE_THRESHOLD)).toBe(true);
  });
});

describe('the percentage conversion (#167)', () => {
  it('shows the stored fraction as the percentage the badge shows', () => {
    expect(thresholdPercent(0.4)).toBe(40);
    expect(thresholdPercent(0)).toBe(0);
    expect(thresholdPercent(1)).toBe(100);
  });

  it('round-trips every step the control offers', () => {
    // The screen steps by 5%. A conversion that did not round-trip would move
    // the stored value every time the screen was opened.
    for (let percent = 0; percent <= 100; percent += 5) {
      expect(thresholdPercent(percentToThreshold(percent))).toBe(percent);
    }
  });

  it('keeps the converted value inside the stored range', () => {
    expect(isValidConfidenceThreshold(percentToThreshold(0))).toBe(true);
    expect(isValidConfidenceThreshold(percentToThreshold(100))).toBe(true);
  });
});

describe('the user guide matches the shipped defaults (#167)', () => {
  /**
   * #167 asks that "the guide matches the shipped behaviour". The defaults are
   * the part of that a test can hold: a guide that names 50 yards and 40% while
   * the code ships something else is the defect #44 was filed for, in miniature.
   */
  const guide = fs.readFileSync(
    path.join(__dirname, '../../docs/user/dope-assisted-aiming.md'),
    'utf8'
  );

  it('names the matching window the app actually ships', () => {
    expect(guide).toContain(`${DEFAULT_DISTANCE_DELTA} yards`);
  });

  it('names the confidence threshold the app actually ships', () => {
    expect(guide).toContain(`${thresholdPercent(DEFAULT_CONFIDENCE_THRESHOLD)}%`);
  });

  it('names the range the matching window control offers', () => {
    expect(guide).toContain(`${MIN_DISTANCE_DELTA_YARDS}–${MAX_DISTANCE_DELTA_YARDS}`);
  });

  it('is linked from the user-guide index, so it can be found', () => {
    const index = fs.readFileSync(path.join(__dirname, '../../docs/user/README.md'), 'utf8');
    expect(index).toContain('./dope-assisted-aiming.md');
  });
});
