import { APP_SCHEME } from '../../src/navigation/linking';
import {
  MAX_SHARE_LINK_LENGTH,
  PROFILE_IMPORT_PATH,
  buildProfileShareLink,
  renderProfileQrSection,
  renderQrSvg,
} from '../../src/utils/profileQr';

import type { ShareableAmmo, ShareableRifle } from '../../src/utils/profileQr';

/**
 * The profile QR on the DOPE card (#66, ADR-016).
 *
 * The card is paper. A QR that does not scan, or that scans to the wrong load,
 * is found out at a range with no way to reprint -- so the tests pin the two
 * things that decide that: what goes into the link, and the hard length cap.
 */

const rifle: ShareableRifle = {
  name: 'Tikka T3x',
  caliber: '6.5 Creedmoor',
  barrelLength: 24,
  twistRate: '1:8',
  zeroDistance: 100,
  clickValueType: 'MIL',
  clickValue: 0.1,
  scopeHeight: 1.5,
};

const ammo: ShareableAmmo = {
  name: 'ELD Match',
  manufacturer: 'Hornady',
  bulletWeight: 140,
  bulletType: 'ELD-M',
  ballisticCoefficientG1: 0.61,
  ballisticCoefficientG7: 0.315,
  muzzleVelocity: 2710,
};

/** Reads a built link back the way an importer would. */
const paramsOf = (url: string): Record<string, string> => {
  const query = url.split('?')[1] ?? '';
  return Object.fromEntries(
    query.split('&').map((pair) => {
      const [key, value = ''] = pair.split('=');
      return [key, decodeURIComponent(value)];
    })
  );
};

describe('buildProfileShareLink', () => {
  it('is a mobiledope:// import link, so the OS camera hands it to the app', () => {
    const result = buildProfileShareLink(rifle, ammo);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.startsWith(`${APP_SCHEME}://${PROFILE_IMPORT_PATH}?`)).toBe(true);
  });

  it('carries every field the solver needs, under a versioned format', () => {
    const result = buildProfileShareLink(rifle, ammo);
    if (!result.ok) throw new Error(result.reason);

    expect(paramsOf(result.url)).toEqual({
      v: '1',
      rn: 'Tikka T3x',
      rc: '6.5 Creedmoor',
      bl: '24',
      tw: '1:8',
      z: '100',
      ct: 'MIL',
      cv: '0.1',
      sh: '1.5',
      an: 'ELD Match',
      am: 'Hornady',
      bw: '140',
      bt: 'ELD-M',
      g1: '0.61',
      g7: '0.315',
      mv: '2710',
    });
  });

  it('round-trips characters that mean something in a URL', () => {
    const awkward = { ...rifle, name: 'A&B = 50% #1?' };
    const result = buildProfileShareLink(awkward, ammo);
    if (!result.ok) throw new Error(result.reason);

    expect(paramsOf(result.url).rn).toBe('A&B = 50% #1?');
  });

  it('leaves out empty optional text rather than sending an empty key', () => {
    const result = buildProfileShareLink(rifle, { ...ammo, bulletType: '', manufacturer: '' });
    if (!result.ok) throw new Error(result.reason);

    expect(paramsOf(result.url)).not.toHaveProperty('bt');
    expect(paramsOf(result.url)).not.toHaveProperty('am');
  });

  it('refuses, with a reason, a profile too long to scan reliably', () => {
    // Long names push the link past what a printed code scans reliably. The
    // ADR asks for a refusal with a message, not an unscannable code.
    const result = buildProfileShareLink({ ...rifle, name: 'x'.repeat(400) }, ammo);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/too long/i);
  });

  it('keeps an ordinary profile well inside the cap', () => {
    const result = buildProfileShareLink(rifle, ammo);
    if (!result.ok) throw new Error(result.reason);

    expect(result.url.length).toBeLessThanOrEqual(MAX_SHARE_LINK_LENGTH);
  });
});

describe('renderQrSvg', () => {
  it('is a square inline SVG with a four-module quiet zone', () => {
    const svg = renderQrSvg('mobiledope://import/profile?v=1', { dark: '#000', light: '#fff' });

    const viewBox = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(viewBox).not.toBeNull();
    // Smallest QR is 21 modules; the quiet zone adds 4 on each side.
    expect(Number(viewBox?.[1])).toBeGreaterThanOrEqual(21 + 8);
    expect(viewBox?.[1]).toBe(viewBox?.[2]);
  });

  it('paints in the colours it is given, so night vision stays red on black', () => {
    const svg = renderQrSvg('x', { dark: '#ff0000', light: '#000000' });

    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('fill="#ff0000"');
  });

  it('is deterministic for the same text', () => {
    const colours = { dark: '#000', light: '#fff' };

    expect(renderQrSvg('same', colours)).toBe(renderQrSvg('same', colours));
    expect(renderQrSvg('same', colours)).not.toBe(renderQrSvg('different', colours));
  });
});

describe('renderProfileQrSection', () => {
  const colours = { dark: '#000000', light: '#ffffff' };

  it('puts the code on its own page: the back of the card', () => {
    const html = renderProfileQrSection(rifle, ammo, colours);

    expect(html).toContain('page-break-before: always');
    expect(html).toContain('<svg');
  });

  it('sets the names beside the one-inch code, so the section fits a 1.5 inch card', () => {
    const html = renderProfileQrSection(rifle, ammo, colours);

    // Stacked above and below, the names and caption push the section past the
    // condensed card's printable height and onto a third page.
    expect(html).toContain('display: flex');
    expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('Tikka T3x'));
  });

  it('names the load the code carries, escaped', () => {
    const html = renderProfileQrSection(
      { ...rifle, name: '<b>Rifle</b>' },
      { ...ammo, name: 'Load & Co' },
      colours
    );

    expect(html).toContain('&lt;b&gt;Rifle&lt;/b&gt;');
    expect(html).toContain('Load &amp; Co');
    expect(html).not.toContain('<b>Rifle</b>');
  });

  it('prints why there is no code instead of an unscannable one', () => {
    const html = renderProfileQrSection({ ...rifle, name: 'x'.repeat(400) }, ammo, colours);

    expect(html).not.toContain('<svg');
    expect(html).toMatch(/too long/i);
  });
});
