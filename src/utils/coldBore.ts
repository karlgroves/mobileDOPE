import type { DOPELog } from '../models/DOPELog';

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
 * Whether the next shot from `rifleId` looks like a cold bore, judged by the
 * gap since that rifle's most recent log.
 *
 * Returns `undefined` when there is nothing to judge from -- no rifle chosen
 * yet -- rather than guessing. #164 requires that cold bore is never silently
 * assumed, so the caller shows what this returned and lets the shooter
 * overrule it; `undefined` leaves the field unanswered, which is also what a
 * log carries when nobody recorded it.
 *
 * A rifle with no history at all is cold: the first shot of the first session
 * is the cold-bore shot by definition.
 */
export const suggestColdBore = (
  logs: DOPELog[],
  rifleId: number | undefined,
  now: Date = new Date()
): boolean | undefined => {
  if (rifleId === undefined) return undefined;

  const cutoff = now.getTime() - COLD_BORE_GAP_MINUTES * 60_000;

  // `some`, not a max over parsed times: an unparseable or future timestamp
  // must not be able to look recent. `NaN > cutoff` is false, and a future
  // timestamp is excluded by the upper bound, so either one simply does not
  // count as a shot that warmed the barrel.
  const firedRecently = logs.some((log) => {
    if (log.rifleId !== rifleId) return false;
    const at = log.timestamp === undefined ? NaN : new Date(log.timestamp).getTime();
    return at >= cutoff && at <= now.getTime();
  });

  return !firedRecently;
};
