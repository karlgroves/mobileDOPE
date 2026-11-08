import fs from 'fs';
import path from 'path';

import { CALIBERS } from '../../src/constants/calibers';
import {
  FACTORY_LOADS,
  factoryLoadById,
  factoryLoadNote,
  factoryLoadsFor,
} from '../../src/constants/factoryLoads';
import { AMMO_MANUFACTURERS } from '../../src/constants/manufacturers';

/**
 * The bundled factory load table (#225).
 *
 * The figures themselves cannot be checked here -- they are copied from the
 * manufacturers' pages, and the citation on each entry is how a reviewer
 * checks them. What can be checked is that every entry is usable by the form,
 * is cited, and is listed in the user docs alongside its source.
 */

const docs = fs.readFileSync(
  path.resolve(__dirname, '../../docs/user/rifle-and-ammo-setup.md'),
  'utf8'
);

describe('every entry', () => {
  it('exists, and the table stays small enough to hand-check', () => {
    expect(FACTORY_LOADS.length).toBeGreaterThanOrEqual(10);
    expect(FACTORY_LOADS.length).toBeLessThanOrEqual(40);
  });

  it('has a unique id', () => {
    const ids = FACTORY_LOADS.map((load) => load.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses a caliber the app offers, so spin drift gets a diameter', () => {
    const offered = new Set(CALIBERS.map((c) => c.value));
    const offenders = FACTORY_LOADS.filter((load) => !offered.has(load.caliber));
    expect(offenders.map((load) => `${load.id}: ${load.caliber}`)).toEqual([]);
  });

  it('uses a manufacturer from the manufacturer list', () => {
    const offenders = FACTORY_LOADS.filter((l) => !AMMO_MANUFACTURERS.includes(l.manufacturer));
    expect(offenders.map((load) => load.id)).toEqual([]);
  });

  it('passes the ammo form’s own range checks', () => {
    // The form refuses values outside these; a pre-fill it would then reject
    // on save is worse than no pre-fill.
    const offenders = FACTORY_LOADS.filter(
      (l) =>
        !(l.bulletWeight > 0 && l.bulletWeight <= 1000) ||
        !(l.ballisticCoefficientG1 > 0 && l.ballisticCoefficientG1 <= 1) ||
        !(l.ballisticCoefficientG7 > 0 && l.ballisticCoefficientG7 <= 1) ||
        !(l.muzzleVelocity >= 500 && l.muzzleVelocity <= 5000)
    );
    expect(offenders.map((load) => load.id)).toEqual([]);
  });

  it('has a G7 below its G1, which a transcription swap would break', () => {
    // The G7 reference projectile has far less drag than G1's, so the same
    // bullet's G7 coefficient is always the smaller -- roughly half.
    const offenders = FACTORY_LOADS.filter(
      (l) => !(l.ballisticCoefficientG7 < l.ballisticCoefficientG1)
    );
    expect(offenders.map((load) => load.id)).toEqual([]);
  });

  it('cites a product page on the manufacturer’s own site, and when it was read', () => {
    const sites: Record<string, string> = {
      Hornady: 'hornady.com/',
      Berger: 'bergerbullets.com/',
    };
    const offenders = FACTORY_LOADS.filter(
      (l) =>
        !sites[l.manufacturer] ||
        !l.sourcePage.startsWith(sites[l.manufacturer]) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(l.accessed) ||
        Number.isNaN(Date.parse(l.accessed)) ||
        !l.productNumber
    );
    expect(offenders.map((load) => load.id)).toEqual([]);
  });

  it('is listed in the user docs with its full source address', () => {
    const offenders = FACTORY_LOADS.filter(
      (l) =>
        !docs.includes(l.name) ||
        !(docs.includes(`https://${l.sourcePage}`) || docs.includes(`https://www.${l.sourcePage}`))
    );
    expect(offenders.map((load) => load.id)).toEqual([]);
  });
  it('shows the same figures in the user docs as in the table', () => {
    // The docs table is the human-readable copy a reviewer checks against the
    // manufacturer's page, so it must not drift from what the app fills in.
    const offenders = FACTORY_LOADS.filter((l) => {
      const row = docs.split('\n').find((line) => line.startsWith(`| ${l.name} `));
      const cells = row?.split('|').map((cell) => cell.trim());
      return (
        !cells ||
        cells[2] !== l.productNumber ||
        cells[3] !== l.ballisticCoefficientG1.toFixed(3) ||
        cells[4] !== l.ballisticCoefficientG7.toFixed(3) ||
        cells[5] !== String(l.muzzleVelocity) ||
        cells[6] !== `${l.testBarrelInches} in.`
      );
    });
    expect(offenders.map((load) => load.id)).toEqual([]);
  });
});

describe('factoryLoadsFor', () => {
  it('narrows to the caliber when it has loads', () => {
    const loads = factoryLoadsFor('.308 Winchester');
    expect(loads.length).toBeGreaterThan(0);
    expect(loads.every((load) => load.caliber === '.308 Winchester')).toBe(true);
  });

  it('offers everything for a caliber with none, or no caliber yet', () => {
    expect(factoryLoadsFor('.45-70')).toEqual(FACTORY_LOADS);
    expect(factoryLoadsFor(undefined)).toEqual(FACTORY_LOADS);
  });
});

describe('factoryLoadById', () => {
  it('finds a load, and nothing for an unknown id', () => {
    expect(factoryLoadById('hornady-80966')?.bulletWeight).toBe(168);
    expect(factoryLoadById('nope')).toBeUndefined();
  });
});

describe('factoryLoadNote', () => {
  it('records the source, the date read and the test barrel', () => {
    const note = factoryLoadNote(factoryLoadById('berger-31011')!);
    expect(note).toBe(
      'Factory figures: Berger #31011, 2750 fps from a 26 in. test barrel. ' +
        'Source: bergerbullets.com/product/6-5-mm-creedmoor-140gr-hybrid-target (read 2026-11-08).'
    );
  });
});
