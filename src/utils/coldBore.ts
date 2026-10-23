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
