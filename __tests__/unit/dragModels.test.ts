import {
  getG1DragCoefficient,
  getG7DragCoefficient,
  getFlightRegime,
  getDragChangeRate,
  getSubsonicBCAdjustment,
  getEffectiveBC,
  analyzeDrag,
  getDragRatio,
  getMaxDragMach,
  MACH_SUBSONIC,
  MACH_TRANSONIC_HIGH,
} from '../../src/utils/dragModels';

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

  describe('getFlightRegime', () => {
    it('should return subsonic for Mach < 0.8', () => {
      expect(getFlightRegime(0.5)).toBe('subsonic');
      expect(getFlightRegime(0.7)).toBe('subsonic');
      expect(getFlightRegime(0.79)).toBe('subsonic');
    });

    it('should return transonic for Mach 0.8-1.2', () => {
      expect(getFlightRegime(0.8)).toBe('transonic');
      expect(getFlightRegime(0.9)).toBe('transonic');
      expect(getFlightRegime(1.0)).toBe('transonic');
      expect(getFlightRegime(1.1)).toBe('transonic');
      expect(getFlightRegime(1.2)).toBe('transonic');
    });

    it('should return supersonic for Mach > 1.2', () => {
      expect(getFlightRegime(1.21)).toBe('supersonic');
      expect(getFlightRegime(1.5)).toBe('supersonic');
      expect(getFlightRegime(2.0)).toBe('supersonic');
    });
  });

  describe('getDragChangeRate', () => {
    it('should be moderate at high supersonic speeds', () => {
      // At Mach 3.0+, drag change rate is lower
      const rate = getDragChangeRate(3348, 'G1'); // ~Mach 3.0
      // Just verify it returns a reasonable value
      expect(Math.abs(rate)).toBeLessThan(1.0);
    });

    it('should be high in transonic zone', () => {
      // Near Mach 1.0, drag changes rapidly
      const rate = getDragChangeRate(1116, 'G1'); // Mach 1.0
      expect(Math.abs(rate)).toBeGreaterThan(0.1);
    });

    it('should return consistent values', () => {
      // Just verify function works and returns reasonable values
      const rate1 = getDragChangeRate(700, 'G1');
      const rate2 = getDragChangeRate(2000, 'G1');
      expect(typeof rate1).toBe('number');
      expect(typeof rate2).toBe('number');
    });
  });

  describe('getSubsonicBCAdjustment', () => {
    it('should return ~1.0 at reference Mach (2.0)', () => {
      const adjustment = getSubsonicBCAdjustment(2.0, 'G1');
      expect(adjustment).toBeCloseTo(1.0, 1);
    });

    it('should return > 1.0 at Mach 1.0 for G1', () => {
      // In G1 table, Cd at Mach 1.0 (0.4805) is LOWER than at Mach 2.0 (0.5934)
      // This means BC is effectively higher at Mach 1.0
      const adjustment = getSubsonicBCAdjustment(1.0, 'G1');
      expect(adjustment).toBeGreaterThan(1.0);
    });

    it('should return > 1.0 at low subsonic speeds', () => {
      // At Mach 0.5, drag is much lower than at Mach 2.0 for G1
      const adjustment = getSubsonicBCAdjustment(0.5, 'G1');
      expect(adjustment).toBeGreaterThan(2.0); // Cd 0.2032 vs 0.5934
    });

    it('should work for both G1 and G7', () => {
      const g1Adj = getSubsonicBCAdjustment(1.0, 'G1');
      const g7Adj = getSubsonicBCAdjustment(1.0, 'G7');
      expect(g1Adj).not.toBe(g7Adj);
    });
  });

  describe('getEffectiveBC', () => {
    it('should increase BC at Mach 1.0 for G1 (lower drag than reference)', () => {
      const publishedBC = 0.5;
      const effectiveBC = getEffectiveBC(publishedBC, 1116, 'G1'); // Mach 1.0
      // G1 Cd at Mach 1.0 is lower than at Mach 2.0, so effective BC is higher
      expect(effectiveBC).toBeGreaterThan(publishedBC);
    });

    it('should return similar BC at reference Mach (2.0)', () => {
      const publishedBC = 0.5;
      const effectiveBC = getEffectiveBC(publishedBC, 2232, 'G1'); // Mach 2.0
      expect(effectiveBC).toBeCloseTo(publishedBC, 1);
    });

    it('should scale with published BC', () => {
      const lowBC = getEffectiveBC(0.3, 1116, 'G1');
      const highBC = getEffectiveBC(0.6, 1116, 'G1');
      expect(highBC).toBeGreaterThan(lowBC);
    });
  });

  describe('analyzeDrag', () => {
    it('should return complete analysis for supersonic flight', () => {
      const analysis = analyzeDrag(2500, 'G1');
      expect(analysis.regime).toBe('supersonic');
      expect(analysis.mach).toBeGreaterThan(MACH_TRANSONIC_HIGH);
      expect(analysis.cd).toBeGreaterThan(0);
      // isUnstable depends on drag change rate
      expect(typeof analysis.isUnstable).toBe('boolean');
      expect(analysis.description).toContain('Supersonic');
    });

    it('should return complete analysis for subsonic flight', () => {
      const analysis = analyzeDrag(800, 'G1');
      expect(analysis.regime).toBe('subsonic');
      expect(analysis.mach).toBeLessThan(MACH_SUBSONIC);
      expect(analysis.cd).toBeGreaterThan(0);
      expect(analysis.description).toContain('Subsonic');
    });

    it('should identify transonic zone', () => {
      const analysis = analyzeDrag(1116, 'G1'); // Mach 1.0
      expect(analysis.regime).toBe('transonic');
      expect(analysis.description).toContain('Transonic');
    });

    it('should provide BC adjustment', () => {
      const analysis = analyzeDrag(800, 'G1');
      expect(analysis.bcAdjustment).toBeDefined();
      expect(analysis.bcAdjustment).toBeGreaterThan(0);
    });
  });

  describe('getDragRatio', () => {
    it('should return 1.0 for same Mach', () => {
      const ratio = getDragRatio(1.5, 1.5, 'G1');
      expect(ratio).toBe(1.0);
    });

    it('should return > 1.0 when going to higher drag (G1: Mach 1.0 to 1.35)', () => {
      // G1 max drag is around Mach 1.35 (Cd = 0.6621)
      // Mach 1.0 Cd = 0.4805
      const ratio = getDragRatio(1.0, 1.35, 'G1');
      expect(ratio).toBeGreaterThan(1.0);
    });

    it('should return < 1.0 when going to lower drag (G1: Mach 1.35 to 0.5)', () => {
      // G1 max drag at 1.35 (Cd = 0.6621), low drag at 0.5 (Cd = 0.2032)
      const ratio = getDragRatio(1.35, 0.5, 'G1');
      expect(ratio).toBeLessThan(1.0);
    });
  });

  describe('getMaxDragMach', () => {
    it('should return max drag in transonic zone for G1', () => {
      const max = getMaxDragMach('G1');
      expect(max.mach).toBeGreaterThan(1.0);
      expect(max.mach).toBeLessThan(2.0);
      expect(max.cd).toBeGreaterThan(0.6);
    });

    it('should return max drag in supersonic zone for G7', () => {
      const max = getMaxDragMach('G7');
      // G7 max drag is also in transonic/low supersonic
      expect(max.mach).toBeGreaterThan(1.0);
      expect(max.cd).toBeGreaterThan(0);
    });

    it('should return different values for G1 and G7', () => {
      const g1 = getMaxDragMach('G1');
      const g7 = getMaxDragMach('G7');
      expect(g1.cd).toBeGreaterThan(g7.cd);
    });
  });
});
