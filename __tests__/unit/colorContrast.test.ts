/**
 * Contrast of the theme's value-text colour (#114).
 *
 * `colors.primary` is a fill: buttons, FABs, borders, the selected tint. As
 * text it fails WCAG AA on the light theme -- 2.55:1 on `surface`, 2.78:1 on
 * `background` -- and it was drawn as text at 34 sites, most of them the
 * corrections and distances a shooter acts on. `colors.primaryText` is the
 * same hue made legible on every theme, and these tests hold it there.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Colors, ThemeMode } from '../../src/constants/colors';

const AA_NORMAL_TEXT = 4.5;

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg: [number, number, number], bg: [number, number, number]): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** `fill` at `alpha` composited over `base` -- how RN draws `colors.primary + '20'`. */
function over(fill: string, alpha: number, base: string): [number, number, number] {
  const f = channels(fill);
  const b = channels(base);
  return [0, 1, 2].map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha))) as [
    number,
    number,
    number,
  ];
}

const MODES: ThemeMode[] = ['dark', 'light', 'nightVision'];

/**
 * Each fill token, the text token that draws its hue legibly, and the fills
 * whose `+ '20'` tint that text is drawn on as well as the plain surfaces:
 *
 * - primary: NumberPicker's selected row (`colors.primary + '20'`)
 * - error: DOPELogList's Delete button and DOPELogEntry's missing-environment
 *   card (`colors.error + '20'`)
 */
const TEXT_TOKENS = [
  ['primary', 'primaryText', ['primary']],
  ['success', 'successText', []],
  ['warning', 'warningText', []],
  ['error', 'errorText', ['error']],
] as const;

describe.each(TEXT_TOKENS)('%s as text', (fill, text, tints) => {
  describe.each(MODES)('%s theme', (mode) => {
    const c = Colors[mode];

    it.each(['background', 'surface'] as const)('passes AA on %s', (surface) => {
      expect(contrast(channels(c[text]), channels(c[surface]))).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT
      );
    });

    const tinted = tints.flatMap((tint) =>
      (['background', 'surface'] as const).map((surface) => [tint, surface] as const)
    );
    if (tinted.length) {
      it.each(tinted)('passes AA on the %s tint over %s', (tint, surface) => {
        const bg = over(c[tint], 0x20 / 255, c[surface]);
        expect(contrast(channels(c[text]), bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      });
    }
  });

  it('is the regression the issue measured: the fill fails as light-theme text', () => {
    // If this ever passes, the fill colour changed and the split may no longer
    // be needed. Until then, the text token must differ from the fill on light.
    const l = Colors.light;
    expect(contrast(channels(l[fill]), channels(l.surface))).toBeLessThan(AA_NORMAL_TEXT);
    expect(l[text]).not.toBe(l[fill]);
  });
});

/**
 * Text drawn *on* a fill -- a Button label, a FAB glyph, the selected segment
 * or unit (#116, #119). This used to be `text.inverse`, which on the light
 * theme was white: 2.78:1 on primary, 2.16:1 on secondary, 3.68:1 on error.
 */
const ON_FILL = [
  ['primary', 'onPrimary'],
  ['secondary', 'onSecondary'],
  ['error', 'onError'],
] as const;

describe.each(ON_FILL)('text on the %s fill', (fill, on) => {
  it.each(MODES)('passes AA on the %s theme', (mode) => {
    const c = Colors[mode];
    expect(contrast(channels(c[on]), channels(c[fill]))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('is the regression #119 fixed: white fails on the light fill', () => {
    expect(contrast(channels('#FFFFFF'), channels(Colors.light[fill]))).toBeLessThan(
      AA_NORMAL_TEXT
    );
  });
});

describe('text.inverse', () => {
  it('no longer exists, so white-on-fill cannot come back', () => {
    // Removing the token lets tsc reject any new use; this pins the removal.
    for (const mode of MODES) expect('inverse' in Colors[mode].text).toBe(false);
  });
});

/**
 * Every `color:` property value in `source`, with the line it starts on. The
 * value runs to the first `,` `}` or `]` outside brackets, so a ternary or a
 * value broken across lines is read whole -- a line-based match missed six
 * sites written that way (#115 review).
 */
function colorValues(source: string): { line: number; value: string }[] {
  const found: { line: number; value: string }[] = [];
  // `color:` alone, not borderColor / backgroundColor / tintColor, which are fills.
  const COLOR_KEY = /(^|[^A-Za-z])color:/g;
  let m: RegExpExecArray | null;
  while ((m = COLOR_KEY.exec(source))) {
    let i = m.index + m[0].length;
    let depth = 0;
    const from = i;
    for (; i < source.length; i++) {
      const ch = source[i];
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) {
        if (depth === 0) break;
        depth--;
      } else if (ch === ',' && depth === 0) break;
    }
    found.push({
      line: source.slice(0, m.index + m[1].length).split('\n').length,
      value: source.slice(from, i),
    });
  }
  return found;
}

// `(?<![.\w])` matches `colors.x`, the name every component and screen gives
// the palette from useTheme(). Nothing reads the static theme any more -- the
// followsTheme test holds that (#116).
const TEXT_IN_FILL = /(?<![.\w])colors\.(primary|success|warning|error)\b/;

describe('colorValues', () => {
  it('reads a ternary broken across lines as one value', () => {
    const src = ['{', '  color:', '    x ? colors.primary : colors.text.secondary,', '}'].join(
      '\n'
    );
    expect(colorValues(src)).toEqual([
      { line: 2, value: '\n    x ? colors.primary : colors.text.secondary' },
    ]);
  });

  it('ignores fill properties and stops at the closing brace', () => {
    const src = '{ borderColor: colors.primary, color: colors.primaryText }';
    const values = colorValues(src);
    expect(values).toHaveLength(1);
    expect(TEXT_IN_FILL.test(values[0].value)).toBe(false);
  });
});

describe('no text is drawn in a fill colour', () => {
  const SRC = path.join(__dirname, '../../src');

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  }

  it('uses the *Text token, never the fill, for a text colour', () => {
    // `\b` after the token lets primaryText, primaryDark, errorDark and the
    // other *Text tokens through.
    const offenders = sourceFiles(SRC).flatMap((file) =>
      colorValues(fs.readFileSync(file, 'utf8'))
        .filter(({ value }) => TEXT_IN_FILL.test(value))
        .map(({ line }) => `${path.relative(SRC, file)}:${line}`)
    );

    expect(offenders).toEqual([]);
  });
});
