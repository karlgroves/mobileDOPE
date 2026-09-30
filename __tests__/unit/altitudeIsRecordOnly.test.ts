import { ALTITUDE_HELP, STATION_PRESSURE_HELP } from '../../src/constants/fieldHelp';
import { calculateDensityAltitude } from '../../src/utils/atmospheric';
import { calculateBallisticSolution } from '../../src/utils/ballistics';
import {
  hasRequiredEnvironmentalInputs,
  missingEnvironmentalInputs,
} from '../../src/utils/calculatorInputs';

import type { AmmoConfig, RifleConfig, ShotParameters } from '../../src/types/ballistic.types';
import type { AtmosphericConditions } from '../../src/utils/atmospheric';

/**
 * Altitude is a record-keeping field, not a solver input (#89).
 *
 * The issue measured it: three altitudes, one pressure, byte-identical answers.
 * `calculateAirDensity` takes temperature and pressure only, and
 * `atmosphere.altitude` is carried through the types and never consumed.
 *
 * The issue then observes that this is *not straightforwardly a bug*. If the
 * user enters **station pressure** — the real pressure where they are standing —
 * then temperature and pressure already carry the altitude information, and
 * reading altitude as well would correct for elevation **twice**.
 *
 * ## Which option this takes, and why
 *
 * The issue offers three. This is **option 2**: stop requiring altitude, keep it
 * as a record-keeping field, and say so.
 *
 * It is chosen because it is the only one consistent with what already shipped.
 * The solver already behaves this way. `docs/user/ballistic-calculator.md` and
 * `quick-start.md` already tell users to enter station pressure.
 * `ballisticsExtremes.test.ts` already pins "altitude does not change the
 * result" as the contract. Option 1 would invert all three at once and make the
 * pressure label wrong again; option 3 adds a conversion mode nobody has asked
 * for yet. Both remain open — this change does not foreclose either, it removes
 * the false promise that the field is doing something it is not.
 *
 * The actual defect the issue names is that *nothing told the user which
 * pressure to enter while the UI implied both were used*. The label half landed
 * with the pressure work; this is the other half: the field is no longer
 * **required**, so the UI stops insisting on a number it will not read.
 */
describe('altitude is recorded, not solved with', () => {
  const rifle: RifleConfig = {
    zeroDistance: 100,
    sightHeight: 1.5,
    twistRate: '1:10',
    barrelLength: 24,
  };

  const ammo: AmmoConfig = {
    bulletWeight: 168,
    ballisticCoefficient: 0.462,
    dragModel: 'G1',
    muzzleVelocity: 2650,
  };

  const shot: ShotParameters = {
    distance: 600,
    angle: 0,
    windSpeed: 0,
    windDirection: 0,
  };

  const atmosphere = (altitude: number | undefined): AtmosphericConditions =>
    ({
      temperature: 59,
      pressure: 29.92,
      humidity: 50,
      altitude,
    }) as AtmosphericConditions;

  it('gives the same answer whether or not an altitude is supplied', () => {
    // The point of making the field optional: omitting it costs the user
    // nothing, because the solver was never reading it.
    const withIt = calculateBallisticSolution(rifle, ammo, shot, atmosphere(5280));
    const without = calculateBallisticSolution(rifle, ammo, shot, atmosphere(undefined));

    expect(without.drop).toBe(withIt.drop);
    expect(without.velocity).toBe(withIt.velocity);
    expect(without.elevationMIL).toBe(withIt.elevationMIL);
  });

  it('does not throw or return NaN without one', () => {
    // A field that stops being required has to actually be survivable. An
    // undefined reaching the integrator would come back as NaN, which the
    // calculator would happily display.
    const result = calculateBallisticSolution(rifle, ammo, shot, atmosphere(undefined));

    expect(Number.isFinite(result.drop)).toBe(true);
    expect(Number.isFinite(result.elevationMIL)).toBe(true);
    expect(Number.isFinite(result.windageMIL)).toBe(true);
    expect(Number.isFinite(result.timeOfFlight)).toBe(true);
  });

  it('still changes the answer when the pressure changes, which is the real input', () => {
    // The corollary the user needs to understand: elevation reaches the solution
    // through station pressure. If this stopped being true, altitude would have
    // to come back.
    const seaLevel = calculateBallisticSolution(rifle, ammo, shot, atmosphere(0));
    const thin = calculateBallisticSolution(rifle, ammo, shot, {
      ...atmosphere(0),
      pressure: 24.9,
    } as AtmosphericConditions);

    expect(thin.drop).not.toBe(seaLevel.drop);
    expect(Math.abs(thin.drop)).toBeLessThan(Math.abs(seaLevel.drop));
  });

  it('double-counts elevation in the density altitude display, which this PR does not fix', () => {
    // Pinned as a known defect rather than left to be rediscovered.
    //
    // `calculatePressureAltitude` is PA = altitude + (29.92 - pressure) * 1000,
    // the standard aviation formula -- correct when `pressure` is the ALTIMETER
    // SETTING. The field now asks for STATION pressure, which already carries
    // the elevation, so the altitude is added a second time.
    //
    // Denver on a standard 59F day, station pressure 24.9 inHg:
    //   altitude 0    ->  7,165 ft density altitude  (right)
    //   altitude 5280 -> 14,700 ft density altitude  (wrong)
    //
    // The error is larger than the altitude itself, because the ISA temperature
    // term is also computed from the inflated pressure altitude and compounds it.
    //
    // There is a second copy of the same formula in `EnvironmentSnapshot`.
    // Fixing both is its own change; this test exists so that change has
    // something to break, and so the figure is written down.
    const stationPressureAtDenver = 24.9;
    const correct = calculateDensityAltitude(59, stationPressureAtDenver, 0);
    const doubleCounted = calculateDensityAltitude(59, stationPressureAtDenver, 5280);

    expect(correct).toBe(7165);
    expect(doubleCounted).toBe(14700);
    expect(doubleCounted - correct).toBeGreaterThan(5280);
  });

  it('is exactly right at sea level, which is why this has survived', () => {
    // With altitude 0 the two conventions coincide, so anyone testing at sea
    // level sees a correct number and no reason to look further.
    expect(calculateDensityAltitude(59, 29.92, 0)).toBe(0);
  });
});

describe('the help text', () => {
  it('tells the user the field is recorded rather than solved with', () => {
    expect(ALTITUDE_HELP).toMatch(/recorded/i);
    expect(ALTITUDE_HELP).toMatch(/does not change the solution/i);
  });

  it('does not send the user to the density altitude display', () => {
    // That display double-counts elevation when station pressure is entered:
    // `calculatePressureAltitude` adds the altitude to the pressure-derived
    // altitude, which is right for an altimeter setting and wrong for a station
    // reading. Its own defect, not fixed here -- so this text must not vouch
    // for it. See the PR description.
    expect(ALTITUDE_HELP).not.toMatch(/density/i);
  });

  it('does not contradict the pressure help, which says pressure carries elevation', () => {
    // These two sit on the same screen, a few fields apart. If one says altitude
    // matters and the other says pressure already accounts for it, the user is
    // left to guess which is true.
    expect(STATION_PRESSURE_HELP).not.toMatch(/altitude/i);
    expect(ALTITUDE_HELP).not.toMatch(/required/i);
  });
});

describe('what the calculator requires', () => {
  const complete = {
    angle: 0,
    temperature: 59,
    pressure: 29.92,
    humidity: 50,
    windSpeed: 0,
    windDirection: 0,
  };

  it('does not require altitude, which is the change #89 asks for', () => {
    // The whole point. Before this, leaving altitude blank showed "Please fill
    // in all environmental parameters" and refused to solve -- for a field the
    // solver does not read.
    expect(hasRequiredEnvironmentalInputs(complete)).toBe(true);
    expect(missingEnvironmentalInputs(complete)).toEqual([]);
  });

  it('is unaffected by whether an altitude was supplied', () => {
    expect(missingEnvironmentalInputs({ ...complete, altitude: 5280 })).toEqual(
      missingEnvironmentalInputs({ ...complete, altitude: undefined })
    );
  });

  it('still requires everything the solver does read', () => {
    for (const field of [
      'angle',
      'temperature',
      'pressure',
      'humidity',
      'windSpeed',
      'windDirection',
    ] as const) {
      expect(hasRequiredEnvironmentalInputs({ ...complete, [field]: undefined })).toBe(false);
    }
  });

  it('names the missing field rather than gesturing at the form', () => {
    // "Please fill in all environmental parameters" on a screen with seven of
    // them is a puzzle, not an error message.
    expect(missingEnvironmentalInputs({ ...complete, temperature: undefined })).toEqual([
      'Temperature',
    ]);
    expect(missingEnvironmentalInputs({})).toHaveLength(6);
  });

  it('calls the pressure field what the screen calls it', () => {
    // A message naming a field the user cannot find on screen is worse than no
    // message. The label moved to "Station Pressure" with the pressure work.
    expect(missingEnvironmentalInputs({ ...complete, pressure: undefined })).toEqual([
      'Station Pressure',
    ]);
  });

  it('treats zero as supplied, not as missing', () => {
    // Every one of these legitimately takes 0: a level shot, no wind, a wind
    // from due north. A falsy check here would make the commonest case
    // unanswerable.
    expect(
      hasRequiredEnvironmentalInputs({
        angle: 0,
        temperature: 0,
        pressure: 0,
        humidity: 0,
        windSpeed: 0,
        windDirection: 0,
      })
    ).toBe(true);
  });
});
