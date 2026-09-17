import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';

import type { DOPELogData } from '../models/DOPELog';
import type { Match } from '../utils/dopeMatching';

/**
 * What this shooter actually dialled, last time conditions looked like this (#70).
 *
 * The first half of DOPE-assisted aiming. `rankMatches` picks the logged entries
 * worth deriving a correction from; this is where the shooter finally sees them,
 * beside the solver's answer, so the two can be compared rather than one
 * replacing the other.
 *
 * ## Deliberately not a recommendation
 *
 * It shows what was recorded and how relevant each entry is. It does not merge
 * them into a suggested correction, and it does not tell the shooter which to
 * trust. Deriving a correction from the offset between predicted and observed is
 * the second half of #70 and is not built; presenting a blend now would look
 * exactly like that feature while being an average of whatever happened to be in
 * the database.
 *
 * ## Why the age is shown
 *
 * Recency is one of the scoring factors, but a percentage hides it. A shooter
 * looking at two entries at the same distance wants to know that one was last
 * autumn with a different lot of ammunition. The score cannot express that; the
 * date can.
 */

/** Rounded whole days between a log's timestamp and now. */
export const daysAgo = (
  timestamp: string | undefined,
  now: Date = new Date()
): number | undefined => {
  if (timestamp === undefined) return undefined;
  const then = Date.parse(timestamp);
  if (Number.isNaN(then)) return undefined;
  return Math.max(0, Math.round((now.getTime() - then) / 86_400_000));
};

/** "today", "3 days ago", "2 months ago" -- short enough for a row. */
export const describeAge = (days: number | undefined): string => {
  if (days === undefined) return 'undated';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
};

export interface RelevantDopeListProps {
  matches: Match<DOPELogData>[];
  /** Injected so the rendered age is deterministic under test. */
  now?: Date;
  testID?: string;
}

export const RelevantDopeList: React.FC<RelevantDopeListProps> = ({ matches, now, testID }) => {
  const { theme } = useTheme();
  const { colors } = theme;

  if (matches.length === 0) {
    return (
      <Text testID={testID} style={[styles.empty, { color: colors.text.secondary }]}>
        No logged DOPE close enough to this shot to be worth comparing.
      </Text>
    );
  }

  return (
    <View testID={testID}>
      {matches.map((match) => {
        const { log } = match;
        const unit = log.distanceUnit === 'meters' ? 'm' : 'yd';
        const age = describeAge(daysAgo(log.timestamp, now));
        const relevance = Math.round(match.score * 100);

        // One node per row, for the same reason the confidence badge is one
        // node: a screen reader walking a distance, two numbers, a unit and a
        // percentage separately gives the shooter nothing they can act on.
        const label =
          `${log.distance} ${log.distanceUnit ?? 'yards'}: ` +
          `elevation ${log.elevationCorrection.toFixed(1)} ${log.correctionUnit}, ` +
          `windage ${log.windageCorrection.toFixed(1)} ${log.correctionUnit}. ` +
          `Shot ${age}. ${relevance} percent relevant.`;

        return (
          <View
            key={log.id ?? `${log.distance}-${log.timestamp ?? ''}`}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={label}
            accessibilityHint="A previously logged correction at a similar distance and conditions"
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <View style={styles.rowMain}>
              <Text style={[styles.distance, { color: colors.text.primary }]}>
                {log.distance}
                {unit}
              </Text>
              <Text style={[styles.corrections, { color: colors.primary }]}>
                {log.elevationCorrection.toFixed(1)} / {log.windageCorrection.toFixed(1)}{' '}
                {log.correctionUnit}
              </Text>
            </View>
            <View style={styles.rowMeta}>
              <Text style={[styles.meta, { color: colors.text.secondary }]}>{age}</Text>
              <Text style={[styles.meta, { color: colors.text.secondary }]}>{relevance}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  empty: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  rowMain: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  distance: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: 'bold',
  },
  corrections: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontSize: 12,
  },
});
