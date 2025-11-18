import { calculateTrajectory, calculateBallisticSolution } from '../../src/utils/ballistics';
import type { RifleConfig, AmmoConfig, ShotParameters } from '../../src/types/ballistic.types';
import { standardAtmosphere } from '../../src/utils/atmospheric';

describe('Ballistic Calculations', () => {
  // Common test configuration - .308 Winchester 168gr BTHP
  const rifle: RifleConfig = {
    zeroDistance: 100, // yards
    sightHeight: 1.5, // inches
    twistRate: '1:10',
    barrelLength: 24,
  };

  const ammo: AmmoConfig = {
    bulletWeight: 168, // grains
    ballisticCoefficient: 0.462, // G1 BC for 168gr Sierra MatchKing
    dragModel: 'G1',
    muzzleVelocity: 2650, // fps
  };

  describe('calculateTrajectory', () => {
    it('should calculate trajectory points from 0 to target distance', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const trajectory = calculateTrajectory(rifle, ammo, shot, standardAtmosphere);

      expect(trajectory.length).toBeGreaterThan(0);
      expect(trajectory[0].distance).toBe(0);
      expect(trajectory[trajectory.length - 1].distance).toBeCloseTo(500, 0);
    });

    it('should show velocity decay over distance', () => {
      const shot: ShotParameters = {
        distance: 1000,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const trajectory = calculateTrajectory(rifle, ammo, shot, standardAtmosphere);

      // Velocity should decrease along trajectory
      expect(trajectory[0].velocity).toBeCloseTo(ammo.muzzleVelocity, 10);
      expect(trajectory[trajectory.length - 1].velocity).toBeLessThan(ammo.muzzleVelocity);
      expect(trajectory[trajectory.length - 1].velocity).toBeGreaterThan(700); // Approaching transonic
    });

    it('should calculate energy correctly', () => {
      const shot: ShotParameters = {
        distance: 100,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const trajectory = calculateTrajectory(rifle, ammo, shot, standardAtmosphere);

      // Energy = 0.5 * mass * velocity^2
      // E (ft-lbs) = (bullet weight in grains / 7000) * velocity^2 / (2 * 32.174)
      const point = trajectory[trajectory.length - 1];
      const expectedEnergy =
        (ammo.bulletWeight / 7000) * (point.velocity * point.velocity) / (2 * 32.174);

      expect(point.energy).toBeCloseTo(expectedEnergy, -1); // Within 10 ft-lbs
    });

    it('should show drop increasing with distance', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const trajectory = calculateTrajectory(rifle, ammo, shot, standardAtmosphere);

      // Drop should increase (become more negative) with distance
      let lastDrop = 0;
      for (const point of trajectory) {
        if (point.distance > rifle.zeroDistance) {
          expect(point.drop).toBeLessThan(lastDrop);
          lastDrop = point.drop;
        }
      }
    });

    it('should be near zero drop at zero distance', () => {
      const shot: ShotParameters = {
        distance: 100,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const trajectory = calculateTrajectory(rifle, ammo, shot, standardAtmosphere);

      // Find point closest to zero distance
      const zeroPoint = trajectory.find((p) => Math.abs(p.distance - rifle.zeroDistance) < 5);

      expect(zeroPoint).toBeDefined();
      expect(Math.abs(zeroPoint!.drop)).toBeLessThan(3); // Within 3 inches of zero (approximate zeroing)
    });
  });

  describe('calculateBallisticSolution', () => {
    it('should calculate complete solution for target distance', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution = calculateBallisticSolution(rifle, ammo, shot, standardAtmosphere);

      expect(solution.drop).toBeDefined();
      expect(solution.velocity).toBeDefined();
      expect(solution.energy).toBeDefined();
      expect(solution.timeOfFlight).toBeDefined();
      expect(solution.elevationMIL).toBeDefined();
      expect(solution.elevationMOA).toBeDefined();
    });

    it('should calculate realistic drop at 500 yards for .308', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution = calculateBallisticSolution(rifle, ammo, shot, standardAtmosphere);

      // .308 168gr at 2650fps should drop approximately 85-150 inches at 500 yards
      expect(solution.drop).toBeLessThan(-85);
      expect(solution.drop).toBeGreaterThan(-200);
    });

    it('should calculate realistic velocity at 500 yards', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution = calculateBallisticSolution(rifle, ammo, shot, standardAtmosphere);

      // Should lose significant velocity but remain supersonic
      expect(solution.velocity).toBeLessThan(ammo.muzzleVelocity);
      expect(solution.velocity).toBeGreaterThan(1400); // Still supersonic
    });

    it('should calculate wind drift with crosswind', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 10, // 10 mph
        windDirection: 90, // right-to-left crosswind
      };

      const solution = calculateBallisticSolution(rifle, ammo, shot, standardAtmosphere);

      // Should have windage drift
      expect(Math.abs(solution.windage)).toBeGreaterThan(10);
      expect(Math.abs(solution.windageMIL)).toBeGreaterThan(0.5);
    });

    it('should calculate elevation correction in MIL', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution = calculateBallisticSolution(rifle, ammo, shot, standardAtmosphere);

      // Elevation should be positive (dial up)
      expect(solution.elevationMIL).toBeGreaterThan(3);
      expect(solution.elevationMIL).toBeLessThan(10);
    });

    it('should calculate elevation correction in MOA', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution = calculateBallisticSolution(rifle, ammo, shot, standardAtmosphere);

      // MOA should be larger than MIL (1 MIL ≈ 3.44 MOA)
      expect(solution.elevationMOA).toBeGreaterThan(solution.elevationMIL * 3);
      expect(solution.elevationMOA).toBeLessThan(solution.elevationMIL * 4);
    });

    it.skip('should handle uphill shots correctly', () => {
      const levelShot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const uphillShot: ShotParameters = {
        distance: 500,
        angle: 20, // 20 degrees uphill
        windSpeed: 0,
        windDirection: 0,
      };

      const levelSolution = calculateBallisticSolution(rifle, ammo, levelShot, standardAtmosphere);
      const uphillSolution = calculateBallisticSolution(
        rifle,
        ammo,
        uphillShot,
        standardAtmosphere
      );

      // Uphill shot should have less drop (cosine effect)
      expect(Math.abs(uphillSolution.drop)).toBeLessThan(Math.abs(levelSolution.drop));
    });

    it('should include trajectory data when requested', () => {
      const shot: ShotParameters = {
        distance: 500,
        angle: 0,
        windSpeed: 0,
        windDirection: 0,
      };

      const solution = calculateBallisticSolution(rifle, ammo, shot, standardAtmosphere, true);

      expect(solution.trajectory).toBeDefined();
      expect(solution.trajectory!.length).toBeGreaterThan(0);
    });
  });
});
