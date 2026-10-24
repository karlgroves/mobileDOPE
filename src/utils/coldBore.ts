/**
 * Minutes of rest after which the next shot is taken to be a cold bore (#164,
 * and #70 §6, which named ten).
 *
 * A guess at a thermal property from a clock, which is all the app can observe
 * without a barrel thermometer. It decides a *suggestion*, never a stored fact
 * on its own.
 */
export const COLD_BORE_GAP_MINUTES = 10;

/**
 * Whether the next shot looks like a cold bore, given when that rifle last
 * fired.
 *
 * `lastFiredAt` is the timestamp of the rifle's most recent DOPE log, or
 * `undefined` if it has none -- in which case the barrel is cold, because the
 * first shot of the first session is the cold-bore shot by definition.
 *
 * Takes a timestamp rather than a list of logs on purpose. The caller has to
 * fetch the rifle's history anyway, and handing this an *in-memory store* of
 * logs made it answer "cold" whenever that store happened to be empty -- which
 * on this screen it usually is, since only DOPE Logs fills it.
 *
 * The result is a suggestion. #164 requires that cold bore is never silently
 * assumed, so the caller shows what this returned, says it came from the gap
 * rule, and lets the shooter overrule it or leave the field unanswered.
 */
export const suggestColdBore = (
  lastFiredAt: string | undefined,
  now: Date = new Date()
): boolean => {
  if (lastFiredAt === undefined) return true;

  const at = new Date(lastFiredAt).getTime();

  // Neither comparison can be satisfied by NaN, so an unparseable timestamp
  // falls through to "cold" rather than being read as a recent shot -- which
  // is what a naive `now - at < gap` does, because every comparison with NaN
  // is false. The upper bound rejects a timestamp in the future, which a
  // backup restored from a device with a skewed clock produces.
  const firedRecently = at >= now.getTime() - COLD_BORE_GAP_MINUTES * 60_000 && at <= now.getTime();

  return !firedRecently;
};

/** "4 minutes", "5 hours", "3 days" -- the gap, at the coarsest useful scale. */
const describeGap = (minutes: number): string => {
  const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'}`;

  if (minutes < 60) return plural(minutes, 'minute');
  if (minutes < 24 * 60) return plural(Math.floor(minutes / 60), 'hour');
  return plural(Math.floor(minutes / (24 * 60)), 'day');
};

/**
 * Why the barrel-state control is pre-set the way it is, in the shooter's words.
 *
 * #164 requires that cold bore is never silently assumed, which is what the hint
 * under the control is for: it lets the shooter check the app's reasoning before
 * accepting it.
 *
 * It therefore has to state the reasoning *that actually applied*. The first cut
 * interpolated {@link COLD_BORE_GAP_MINUTES} into "Suggested from the 10 minutes
 * since this rifle last fired", which reads as a claim about the elapsed time and
 * was false for every gap except one of almost exactly ten minutes -- a rifle
 * last fired three days ago was told it had been ten minutes. A hint that
 * misstates the reason is worse than no hint, because it invites the shooter to
 * confirm something they cannot.
 *
 * So the three reasons the rule can have are reported as three different
 * sentences, each naming the real gap and distinguishing the threshold from it.
 * {@link suggestColdBore} remains the single decision; this only explains it, and
 * a test asserts the two never disagree about which side of the gap a timestamp
 * falls on.
 */
export const describeColdBoreSuggestion = (
  lastFiredAt: string | undefined,
  now: Date = new Date()
): string => {
  const tail = 'Change it if that is wrong.';

  // The first shot of the first string is a cold bore by definition, and no gap
  // was measured -- so the gap rule must not be cited as though it had been.
  if (lastFiredAt === undefined) {
    return `Suggested because this rifle has no earlier logs, so this is its first recorded shot. ${tail}`;
  }

  const at = new Date(lastFiredAt).getTime();
  const elapsed = now.getTime() - at;

  // Unparseable, or dated in the future by a skewed clock. `suggestColdBore`
  // still answers "cold" for both, which is the safe side -- but there is no
  // honest elapsed time to print, and inventing one here would be the same
  // class of defect this function exists to remove.
  if (Number.isNaN(at) || elapsed < 0) {
    return `Suggested because this rifle's last shot time could not be read. ${tail}`;
  }

  const minutes = Math.floor(elapsed / 60_000);
  const gap = `the ${COLD_BORE_GAP_MINUTES}-minute cold-bore gap`;

  return suggestColdBore(lastFiredAt, now)
    ? `Suggested because this rifle last fired ${describeGap(minutes)} ago, more than ${gap}. ${tail}`
    : `Suggested because this rifle fired ${describeGap(minutes)} ago, inside ${gap}. ${tail}`;
};
