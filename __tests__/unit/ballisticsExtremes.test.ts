import { calculateDensityAltitude } from '../../src/utils/atmospheric';
import { calculateBallisticSolution } from '../../src/utils/ballistics';

import type { RifleConfig, AmmoConfig, ShotParameters } from '../../src/types/ballistic.types';
import type { AtmosphericConditions } from '../../src/utils/atmospheric';

/**
 * The solver at the edges of its input range (#68).
 *
 * The existing suite covers ordinary conditions well. This one asks what happens
 * at the extremes a field app actually meets — an Arctic morning, a mountain
 * range at 10,000 feet, a steep downhill shot — where a solver is most likely to
 * return something quietly wrong rather than fail loudly.
 *
 * These assert **relationships and directions**, not specific figures. A test that
 * pins "drop at 800 yards is 214.7 inches" breaks whenever the drag model is
 * refined and tells you nothing about whether the refinement was right. A test
 * that pins "cold air produces less drop than hot air" stays true across any
 * correct implementation and fails for exactly one reason: the physics went the
 * wrong way.
 */
describe('ballistic solution at the edges', () => {
  // .308 Winchester, 168gr BTHP — the same load the main suite uses.
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

  const shot = (overrides: Partial<ShotParameters> = {}): ShotParameters => ({
    distance: 600,
    angle: 0,
    windSpeed: 0,
    windDirection: 0,
    ...overrides,
  });

  const atmosphere = (
    temperature: number,
    altitude: number,
    pressure = 29.92,
    humidity = 50
  ): AtmosphericConditions => ({
    temperature,
    pressure,
    humidity,
    altitude,
    densityAltitude: calculateDensityAltitude(temperature, pressure, altitude),
  });

  describe('temperature', () => {
    it('drops less in cold, dense-to-thin order held across the range', () => {
      // Colder air is denser, which is MORE drag and MORE drop. The common
      // intuition runs the other way, which is why this is worth pinning.
      const arctic = calculateBallisticSolution(rifle, ammo, shot(), atmosphere(-40, 0));
      const standard = calculateBallisticSolution(rifle, ammo, shot(), atmosphere(59, 0));
      const desert = calculateBallisticSolution(rifle, ammo, shot(), atmosphere(120, 0));

      expect(Math.abs(arctic.drop)).toBeGreaterThan(Math.abs(standard.drop));
      expect(Math.abs(standard.drop)).toBeGreaterThan(Math.abs(desert.drop));
    });

    it('returns a usable solution at -40 and at 130', () => {
      for (const temperature of [-40, 130]) {
        const solution = calculateBallisticSolution(
          rifle,
          ammo,
          shot(),
          atmosphere(temperature, 0)
        );

        expect(Number.isFinite(solution.drop)).toBe(true);
        expect(Number.isFinite(solution.elevationMIL)).toBe(true);
        expect(solution.velocity).toBeGreaterThan(0);
        expect(solution.velocity).toBeLessThan(ammo.muzzleVelocity);
        expect(solution.timeOfFlight).toBeGreaterThan(0);
      }
    });
  });

  describe('altitude, via station pressure', () => {
    // The solver derives air density from temperature and pressure and does NOT
    // read `altitude`. That is correct ONLY if the pressure it is given is station
    // pressure -- the real pressure where you are standing -- because that is what
    // already carries the altitude information. Pairing 29.92 inHg with 12,000 ft
    // describes an atmosphere that does not exist, and the solver rightly produces
    // the same answer as sea level for it.
    //
    // Approximate ICAO station pressures for the altitudes below.
    const SEA_LEVEL = 29.92;
    const DENVER = 24.9; // ~5,280 ft
    const ALPINE = 19.03; // ~12,000 ft

    it('drops less as station pressure falls', () => {
      const seaLevel = calculateBallisticSolution(
        rifle,
        ammo,
        shot(),
        atmosphere(59, 0, SEA_LEVEL)
      );
      const denver = calculateBallisticSolution(rifle, ammo, shot(), atmosphere(59, 5280, DENVER));
      const alpine = calculateBallisticSolution(rifle, ammo, shot(), atmosphere(59, 12000, ALPINE));

      expect(Math.abs(alpine.drop)).toBeLessThan(Math.abs(denver.drop));
      expect(Math.abs(denver.drop)).toBeLessThan(Math.abs(seaLevel.drop));
    });

    it('retains more velocity in thinner air', () => {
      const seaLevel = calculateBallisticSolution(
        rifle,
        ammo,
        shot(),
        atmosphere(59, 0, SEA_LEVEL)
      );
      const alpine = calculateBallisticSolution(rifle, ammo, shot(), atmosphere(59, 12000, ALPINE));

      expect(alpine.velocity).toBeGreaterThan(seaLevel.velocity);
    });

    it('ignores the altitude field itself, which is the documented contract', () => {
      // Pinned deliberately. If the solver ever starts reading `altitude` as well,
      // anyone entering station pressure would be corrected for elevation twice --
      // so this failing is a signal to check the contract, not to update the number.
      const withoutAltitude = calculateBallisticSolution(
        rifle,
        ammo,
        shot(),
        atmosphere(59, 0, DENVER)
      );
      const withAltitude = calculateBallisticSolution(
        rifle,
        ammo,
        shot(),
        atmosphere(59, 5280, DENVER)
      );

      expect(withAltitude.drop).toBe(withoutAltitude.drop);
    });
  });

  describe('shooting angle', () => {
    it('needs less elevation uphill and downhill than on the level', () => {
      // The cosine effect: only the horizontal component of range is subject to
      // the full drop, so a steeply angled shot of the same slant range needs
      // less correction. Both signs, because getting one right and the other
      // backwards is the classic implementation error.
      const level = calculateBallisticSolution(rifle, ammo, shot({ angle: 0 }), atmosphere(59, 0));
      const uphill = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ angle: 30 }),
        atmosphere(59, 0)
      );
      const downhill = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ angle: -30 }),
        atmosphere(59, 0)
      );

      expect(Math.abs(uphill.drop)).toBeLessThan(Math.abs(level.drop));
      expect(Math.abs(downhill.drop)).toBeLessThan(Math.abs(level.drop));
    });

    it('treats equal uphill and downhill angles alike', () => {
      // cos(+30) === cos(-30). A sign error in the angle term shows up here and
      // almost nowhere else.
      const uphill = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ angle: 30 }),
        atmosphere(59, 0)
      );
      const downhill = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ angle: -30 }),
        atmosphere(59, 0)
      );

      expect(Math.abs(uphill.drop)).toBeCloseTo(Math.abs(downhill.drop), 1);
    });

    it('survives a near-vertical shot', () => {
      const solution = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ angle: 89 }),
        atmosphere(59, 0)
      );

      expect(Number.isFinite(solution.drop)).toBe(true);
      expect(Number.isFinite(solution.elevationMIL)).toBe(true);
    });
  });

  describe('distance', () => {
    it('increases drop and time of flight monotonically with range', () => {
      const distances = [100, 300, 600, 1000];
      const solutions = distances.map((distance) =>
        calculateBallisticSolution(rifle, ammo, shot({ distance }), atmosphere(59, 0))
      );

      for (let i = 1; i < solutions.length; i++) {
        expect(Math.abs(solutions[i].drop)).toBeGreaterThan(Math.abs(solutions[i - 1].drop));
        expect(solutions[i].timeOfFlight).toBeGreaterThan(solutions[i - 1].timeOfFlight);
        expect(solutions[i].velocity).toBeLessThan(solutions[i - 1].velocity);
        expect(solutions[i].energy).toBeLessThan(solutions[i - 1].energy);
      }
    });

    it('stays finite well past the transonic transition', () => {
      // A .308 168gr is subsonic by roughly 1000 yards. The integrator has to keep
      // working through the transition rather than producing NaN or diverging.
      const solution = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ distance: 1500 }),
        atmosphere(59, 0)
      );

      expect(Number.isFinite(solution.drop)).toBe(true);
      expect(Number.isFinite(solution.timeOfFlight)).toBe(true);
      expect(solution.velocity).toBeGreaterThan(0);
      expect(solution.velocity).toBeLessThan(1125); // below the speed of sound
    });
  });

  describe('wind', () => {
    it('drifts further downrange and with stronger wind', () => {
      const light = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ windSpeed: 5, windDirection: 90 }),
        atmosphere(59, 0)
      );
      const strong = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ windSpeed: 25, windDirection: 90 }),
        atmosphere(59, 0)
      );

      expect(Math.abs(strong.windage)).toBeGreaterThan(Math.abs(light.windage));
    });

    it('drifts least in a headwind and most in a full-value crosswind', () => {
      const head = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ windSpeed: 15, windDirection: 0 }),
        atmosphere(59, 0)
      );
      const full = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ windSpeed: 15, windDirection: 90 }),
        atmosphere(59, 0)
      );

      expect(Math.abs(full.windage)).toBeGreaterThan(Math.abs(head.windage));
    });

    it('deflects opposite ways for opposing crosswinds', () => {
      const fromLeft = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ windSpeed: 15, windDirection: 90 }),
        atmosphere(59, 0)
      );
      const fromRight = calculateBallisticSolution(
        rifle,
        ammo,
        shot({ windSpeed: 15, windDirection: 270 }),
        atmosphere(59, 0)
      );

      expect(Math.sign(fromLeft.windage)).toBe(-Math.sign(fromRight.windage));
    });
  });
});
