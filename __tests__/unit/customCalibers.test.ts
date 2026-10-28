import {
  CALIBERS,
  caliberDiameter,
  caliberOptionsWith,
  setCustomCalibers,
} from '../../src/constants/calibers';
import {
  removeCustomCaliber,
  upsertCustomCaliber,
  validateCustomCaliber,
} from '../../src/utils/customCalibers';
import { getBulletDiameter } from '../../src/utils/spinDrift';

/**
 * Custom calibers (#67, "add caliber database management").
 *
 * The seeded list is the single source of truth for the calibers it covers;
 * a shooter's own sit beside it. Each carries a bullet diameter, because the
 * spin drift term needs one and the name is not a safe source of it -- that is
 * what the seeded database was built to stop (see constants/calibers.ts).
 */

afterEach(() => setCustomCalibers([]));

describe('validateCustomCaliber', () => {
  it('accepts a new name with a plausible diameter, trimmed', () => {
    expect(validateCustomCaliber({ name: '  6.5 PRC ', diameter: 0.264 }, [])).toEqual({
      caliber: { name: '6.5 PRC', diameter: 0.264 },
      errors: {},
    });
  });

  it('requires a name', () => {
    expect(validateCustomCaliber({ name: '   ', diameter: 0.264 }, []).errors.name).toMatch(
      /required/i
    );
  });

  it('caps the name length so it fits the picker', () => {
    const { errors } = validateCustomCaliber({ name: 'x'.repeat(41), diameter: 0.264 }, []);
    expect(errors.name).toMatch(/40/);
  });

  it('requires a diameter, inside the range of rifle bullets', () => {
    expect(validateCustomCaliber({ name: 'A', diameter: undefined }, []).errors.diameter).toMatch(
      /required/i
    );
    // Someone typing the cartridge name's number -- 6.5, or 308 -- rather
    // than inches is exactly the error the seeded table exists to prevent.
    expect(validateCustomCaliber({ name: 'A', diameter: 6.5 }, []).errors.diameter).toMatch(
      /0\.170.*0\.510/
    );
    expect(validateCustomCaliber({ name: 'A', diameter: 0.1 }, []).errors.diameter).toBeDefined();
    expect(validateCustomCaliber({ name: 'A', diameter: 0.51 }, []).errors).toEqual({});
  });

  it('refuses a name the built-in list already has, by value or by label', () => {
    expect(
      validateCustomCaliber({ name: '6.5 creedmoor', diameter: 0.264 }, []).errors.name
    ).toMatch(/built in/i);
    expect(
      validateCustomCaliber({ name: '6.5mm Creedmoor', diameter: 0.264 }, []).errors.name
    ).toMatch(/built in/i);
  });

  it('refuses a duplicate of another custom caliber, ignoring case', () => {
    const existing = [{ name: '6.5 PRC', diameter: 0.264 }];
    expect(
      validateCustomCaliber({ name: '6.5 prc', diameter: 0.264 }, existing).errors.name
    ).toMatch(/already/i);
  });

  it('lets a caliber keep its own name while it is being edited', () => {
    const existing = [{ name: '6.5 PRC', diameter: 0.264 }];
    expect(
      validateCustomCaliber({ name: '6.5 PRC', diameter: 0.2645 }, existing, '6.5 PRC').errors
    ).toEqual({});
  });
});

describe('upsertCustomCaliber and removeCustomCaliber', () => {
  const prc = { name: '6.5 PRC', diameter: 0.264 };
  const lapua = { name: '.338 Lapua', diameter: 0.338 };

  it('adds, keeping the list in name order', () => {
    expect(upsertCustomCaliber([prc], undefined, lapua)).toEqual([lapua, prc]);
  });

  it('replaces the one being edited, under its new name', () => {
    expect(
      upsertCustomCaliber([prc, lapua], '6.5 PRC', { name: '6.5 PRC Mag', diameter: 0.264 })
    ).toEqual([lapua, { name: '6.5 PRC Mag', diameter: 0.264 }]);
  });

  it('removes by name and leaves the rest', () => {
    expect(removeCustomCaliber([prc, lapua], '6.5 PRC')).toEqual([lapua]);
  });
});

describe('custom calibers in the shared database', () => {
  it('appear in the picker after every built-in one, marked as the shooter’s', () => {
    const options = caliberOptionsWith([{ name: '6.5 PRC', diameter: 0.264 }]);

    expect(options).toHaveLength(CALIBERS.length + 1);
    expect(options.at(-1)).toEqual({ label: '6.5 PRC (custom)', value: '6.5 PRC' });
  });

  it('give the solver their own diameter rather than a guess from the name', () => {
    // Without it, "6.5 PRC" reaches the name parser in spinDrift.ts.
    setCustomCalibers([{ name: '6.5 PRC', diameter: 0.264 }]);

    expect(caliberDiameter('6.5 prc')).toBe(0.264);
    expect(getBulletDiameter('6.5 PRC')).toBe(0.264);
  });

  it('stop resolving once they are removed', () => {
    setCustomCalibers([{ name: 'Wildcat', diameter: 0.3 }]);
    setCustomCalibers([]);

    expect(caliberDiameter('Wildcat')).toBeUndefined();
  });
});
