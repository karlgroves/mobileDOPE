import { getG1DragCoefficient, getG7DragCoefficient } from '../../src/utils/dragModels';

describe('Drag Models', () => {
  describe('G1 Drag Model', () => {
    it('should return drag coefficient for subsonic velocities', () => {
      const cd = getG1DragCoefficient(800); // fps, well below Mach 1
      expect(cd).toBeGreaterThan(0);
      expect(cd).toBeLessThan(1);
    });

    it('should return higher drag coefficient near transonic', () => {
      const subsonic = getG1DragCoefficient(900);
      const transonic = getG1DragCoefficient(1100);
      expect(transonic).toBeGreaterThan(subsonic);
    });

    it('should handle supersonic velocities', () => {
      const cd = getG1DragCoefficient(2500); // fps
      expect(cd).toBeGreaterThan(0);
      expect(cd).toBeLessThan(1);
    });

    it('should handle very high velocities', () => {
      const cd = getG1DragCoefficient(3500); // fps
      expect(cd).toBeGreaterThan(0);
      expect(cd).toBeLessThan(1);
    });

    it('should handle low velocities', () => {
      const cd = getG1DragCoefficient(500); // fps
      expect(cd).toBeGreaterThan(0);
      expect(cd).toBeLessThan(1);
    });
  });

  describe('G7 Drag Model', () => {
    it('should return drag coefficient for subsonic velocities', () => {
      const cd = getG7DragCoefficient(800); // fps
      expect(cd).toBeGreaterThan(0);
      expect(cd).toBeLessThan(1);
    });

    it('should return different values than G1', () => {
      const velocity = 2000;
      const g1 = getG1DragCoefficient(velocity);
      const g7 = getG7DragCoefficient(velocity);
      expect(g7).not.toEqual(g1);
    });

    it('should handle transonic velocities', () => {
      const cd = getG7DragCoefficient(1100); // fps, near Mach 1
      expect(cd).toBeGreaterThan(0);
      expect(cd).toBeLessThan(1);
    });

    it('should handle supersonic velocities', () => {
      const cd = getG7DragCoefficient(2500); // fps
      expect(cd).toBeGreaterThan(0);
      expect(cd).toBeLessThan(1);
    });

    it('should handle very high velocities', () => {
      const cd = getG7DragCoefficient(3500); // fps
      expect(cd).toBeGreaterThan(0);
      expect(cd).toBeLessThan(1);
    });

    it('should be more efficient than G1 at long range (lower Cd)', () => {
      // G7 projectiles are more aerodynamic
      const velocity = 1500;
      const g1 = getG1DragCoefficient(velocity);
      const g7 = getG7DragCoefficient(velocity);
      // G7 should have lower drag for boat-tail bullets
      expect(g7).toBeLessThan(g1);
    });
  });
});
