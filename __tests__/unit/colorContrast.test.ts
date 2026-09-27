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

describe('primaryText contrast', () => {
  describe.each(MODES)('%s theme', (mode) => {
    const c = Colors[mode];

    it.each(['background', 'surface'] as const)('passes AA on %s', (surface) => {
      expect(contrast(channels(c.primaryText), channels(c[surface]))).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT
      );
    });

    // NumberPicker draws its checkmark on the selected row, which is
    // `colors.primary + '20'` (alpha 0x20) over the modal surface.
    it.each(['background', 'surface'] as const)(
      'passes AA on the selected-row tint over %s',
      (surface) => {
        const tinted = over(c.primary, 0x20 / 255, c[surface]);
        expect(contrast(channels(c.primaryText), tinted)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    );
  });

  it('is the regression the issue measured: primary fails as light-theme text', () => {
    // If this ever passes, the fill colour changed and the split may no longer
    // be needed. Until then, primaryText must differ from primary on light.
    const l = Colors.light;
    expect(contrast(channels(l.primary), channels(l.surface))).toBeLessThan(AA_NORMAL_TEXT);
    expect(l.primaryText).not.toBe(l.primary);
  });
});

describe('no text is drawn in the fill colour', () => {
  const SRC = path.join(__dirname, '../../src');

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(p);
      return /\.tsx?$/.test(e.name) ? [p] : [];
    });
  }

  it('uses colors.primaryText, never colors.primary, for a text colour', () => {
    // `color:` alone, not borderColor / backgroundColor / tintColor, which are
    // fills. `\b` after `primary` lets primaryText and primaryDark through.
    const TEXT_IN_FILL = /(^|[^A-Za-z])color:\s*colors\.primary\b/;

    const offenders = sourceFiles(SRC).flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${path.relative(SRC, file)}:${i + 1}` }))
        .filter(({ line }) => TEXT_IN_FILL.test(line))
        .map(({ at }) => at)
    );

    expect(offenders).toEqual([]);
  });
});
