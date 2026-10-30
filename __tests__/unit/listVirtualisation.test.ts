import fs from 'fs';
import path from 'path';

/**
 * Every unbounded list is virtualised (#68, "test scrolling performance with
 * large datasets").
 *
 * A static sweep rather than a timing test, deliberately. Scroll performance in
 * React Native is not a number to measure on a development machine -- it is a
 * structural property of the list: a `ScrollView` whose children come from
 * `collection.map(...)` mounts every row, lays all of them out and keeps all of
 * them mounted. With 1,200 logs that is 1,200 component trees built before the
 * first frame, and the cost is paid on a phone rather than here. A wall-clock
 * assertion in this repository could not see it at all; the renderer these
 * tests use mounts into a tree with no layout pass and no frame budget.
 *
 * So the property asserted is the one that actually decides the answer. It also
 * catches the next screen rather than today's, which a timing test on one list
 * never would -- the same reasoning `offlineFirst.test.ts` and
 * `distanceBoundary.test.ts` are written on.
 *
 * `dopeLogQueryPerformance.test.ts` covers the other half of a large history,
 * which is getting 1,200 rows out of SQLite.
 */

const srcDir = path.resolve(__dirname, '../../src');

/** Every .ts/.tsx source under a directory, as [relative path, contents]. */
const sourcesUnder = (dir: string, base = dir): [string, string][] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourcesUnder(full, base);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return [[path.relative(base, full), fs.readFileSync(full, 'utf8')] as [string, string]];
  });

const sources = sourcesUnder(srcDir);

/**
 * Collections with no ceiling at all, which is a narrower set than "arrays".
 *
 * A shooter logs a shot at a time for years, chronographs string after string,
 * and captures the weather every time they go out: those three grow without
 * limit. `rifles` and `ammoProfiles` grow too, but to tens rather than
 * thousands, and in this app they are mostly Picker options rather than scrolled
 * rows -- `distancePresets` is ten, `customCalibers` a handful, a wind table
 * fifty cells.
 *
 * Drawing the line here is a judgement, and this is where it is recorded. It is
 * drawn tightly on purpose: the first version of this list included `rifles`
 * and flagged four screens that build Picker options from it, which is not a
 * scrolling problem at all. A rule that fires on things that are fine is a rule
 * somebody switches off.
 *
 * Add to this when a new unbounded collection appears.
 */
const UNBOUNDED = ['dopeLogs', 'shotStrings', 'snapshots'];

/** React Native's virtualised list components. */
const VIRTUALISED = /\b(FlatList|SectionList|VirtualizedList|FlashList)\b/;

/**
 * Whether a `.map(` at `index` renders elements rather than building data.
 *
 * `logs.map((log) => <Row .../>)` mounts a component tree per row; the four
 * screens that write `rifles.map((r) => ({ label, value }))` are producing
 * Picker options, and the Picker decides how to render them. Only the first is
 * a scrolling concern, and the difference is whether the body is JSX.
 */
const mapsToElements = (source: string, index: number): boolean => {
  const body = source.slice(index, index + 400);
  // The arrow's body, past any parameter list and an opening paren or brace.
  const arrow = body.indexOf('=>');
  if (arrow < 0) return false;
  const after = body.slice(arrow + 2).replace(/^[\s(]*/, '');
  // A JSX body opens with a tag or a fragment; a data body opens with `{`.
  return after.startsWith('<');
};

/**
 * The index just past the `)` that closes the `(` at `open`, or -1.
 *
 * A regex cannot do this: `\([^)]*\)` stops at the first `)`, so
 * `dopeLogs.filter((l) => l.ok).map(...)` -- the usual shape of a filter --
 * escaped the sweep entirely.
 */
const pastClosingParen = (source: string, open: number): number => {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')' && --depth === 0) return i + 1;
  }
  return -1;
};

/**
 * Where a `.map(` on `name` begins, following any `.filter(...)`, `.slice(...)`
 * or `.sort(...)` chained before it, however their arguments nest.
 */
const mapCallsOn = (source: string, name: string): number[] => {
  const found: number[] = [];
  const link = /^\s*\.\s*(filter|slice|sort|map)\s*\(/;
  for (const match of source.matchAll(new RegExp(`\\b${name}\\b`, 'g'))) {
    let at = (match.index ?? 0) + name.length;
    for (;;) {
      const step = link.exec(source.slice(at));
      if (!step) break;
      const open = at + step[0].length - 1;
      if (step[1] === 'map') {
        found.push(open);
        break;
      }
      at = pastClosingParen(source, open);
      if (at < 0) break;
    }
  }
  return found;
};

/** Unbounded collections a source maps into elements. */
const rendersUnbounded = (source: string): string[] =>
  UNBOUNDED.filter((name) => mapCallsOn(source, name).some((at) => mapsToElements(source, at)));

describe('unbounded lists are virtualised (#68)', () => {
  it('finds the sources, so a broken sweep cannot pass vacuously', () => {
    expect(sources.length).toBeGreaterThan(40);
    expect(sources.filter(([, source]) => VIRTUALISED.test(source)).length).toBeGreaterThan(2);
  });

  it('names collections that actually appear in the app', () => {
    // A typo in UNBOUNDED would silently stop gating a real list, and the
    // suite would stay green. Every name has to be something the code uses.
    const all = sources.map(([, source]) => source).join('\n');
    for (const name of UNBOUNDED) {
      expect(all).toContain(name);
    }
  });

  it('sees a mapping through chained calls, however their arguments nest', () => {
    // Positive controls for the sweep itself, so a matcher that silently stops
    // matching fails here rather than passing every screen.
    expect(rendersUnbounded('dopeLogs.map((l) => <Row key={l.id} />)')).toEqual(['dopeLogs']);
    expect(
      rendersUnbounded('dopeLogs.filter((l) => l.ok).map((l) => (\n  <Row key={l.id} />\n))')
    ).toEqual(['dopeLogs']);
    expect(
      rendersUnbounded('shotStrings.sort((a, b) => a.t - b.t).slice(0, 5).map((s) => <Row />)')
    ).toEqual(['shotStrings']);
    expect(rendersUnbounded('dopeLogs.filter((l) => l.ok).map((l) => ({ id: l.id }))')).toEqual([]);
  });

  it('maps no unbounded collection into elements, which is what a ScrollView row is', () => {
    // Deliberately NOT filtered to files that contain `ScrollView`, and NOT
    // skipping files that mention a virtualised component. Both filters were
    // per-FILE, so a screen that used a `FlatList` for one list and mapped
    // `dopeLogs` into rows for another passed the gate silently -- verified with
    // a positive control: the identical violation is caught in a file with no
    // `FlatList` and missed in one that has it anywhere.
    //
    // The narrower rule is also the more accurate one. A virtualised list takes
    // `data` and `renderItem`; it never maps the collection into elements
    // itself. So mapping an unbounded collection into JSX in a screen or
    // component IS the thing being prohibited, whatever else the file contains.
    const offenders = sources
      .filter(([file]) => file.startsWith('screens') || file.startsWith('components'))
      .flatMap(([file, source]) => rendersUnbounded(source).map((name) => `${file}: ${name}`))
      .sort();

    expect(offenders).toEqual([]);
  });

  it('gives each unbounded collection a virtualised renderer somewhere', () => {
    // The complement of the rule above: a collection that is gated but never
    // rendered at all would pass the sweep while the feature was missing, and
    // one rendered only inside a bounded form is worth knowing about too.
    const rendered = new Set(
      sources
        .filter(([, source]) => VIRTUALISED.test(source))
        .flatMap(([, source]) =>
          UNBOUNDED.filter((name) => new RegExp(`\\b${name}\\b`).test(source))
        )
    );

    // Only `dopeLogs` is required to have one. `snapshots` is read by hooks and
    // the solver rather than listed under that name, and `ShotStringHistory`
    // calls its (already virtualised) data `sessions` -- which is this sweep's
    // known limitation: it matches identifiers, so a renamed local escapes it.
    // The limitation is acceptable because the identifiers it does match are
    // the store arrays every screen reads, and stating it is better than a rule
    // that implies a guarantee it cannot give.
    expect([...rendered]).toContain('dopeLogs');
    expect(
      sources.filter(([file, source]) => file.startsWith('screens') && VIRTUALISED.test(source))
        .length
    ).toBeGreaterThanOrEqual(5);
  });
});
