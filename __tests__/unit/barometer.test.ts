import { calculateAirDensity } from '../../src/utils/atmospheric';
import {
  HPA_PER_INHG,
  MAX_BAROMETER_OFFSET_INHG,
  hPaToInHg,
  isValidBarometerOffset,
  stationPressureFromSensor,
} from '../../src/utils/barometer';

/**
 * Turning a phone barometer reading into the pressure the solver wants (#62).
 *
 * The solver derives air density from temperature and STATION pressure in inHg
 * (`calculateAirDensity`). A phone barometer reports station pressure too, in
 * hPa -- the absolute pressure at the handset, not the sea-level "altimeter
 * setting" a weather report gives. So the conversion is a unit change and
 * nothing else; correcting it to sea level would hand the solver the air of a
 * place the shooter is not standing in.
 */
describe('hPaToInHg', () => {
  it('maps the standard sea-level atmosphere onto 29.92 inHg', () => {
    expect(hPaToInHg(1013.25)).toBeCloseTo(29.92, 2);
  });

  it('uses the exact definition of the inch of mercury', () => {
    // 1 inHg (at 0 °C, standard gravity) = 3386.389 Pa.
    expect(HPA_PER_INHG).toBeCloseTo(33.86389, 5);
    expect(hPaToInHg(HPA_PER_INHG)).toBeCloseTo(1, 10);
  });
});

describe('stationPressureFromSensor', () => {
  it('keeps station pressure as station pressure -- no sea-level correction', () => {
    // ISA pressure at 5,000 ft is 843.07 hPa. The app's own "High Altitude
    // (5000ft)" preset is 24.9 inHg for the same reason. A sea-level correction
    // would turn this back into ~29.92 and the solver would fly the bullet
    // through air some 18% denser than it is.
    const station = stationPressureFromSensor([843.07], 0);
    expect(station).toBeCloseTo(24.9, 2);
    expect(station).not.toBeCloseTo(29.92, 0);
  });

  it('gives the solver an air density in proportion to what the sensor measured', () => {
    // The property that matters: density scales with the pressure the phone
    // actually felt. A wrong basis or a wrong unit breaks this ratio.
    const sensorHpa = 843.07;
    const station = stationPressureFromSensor([sensorHpa], 0) as number;
    const ratio = calculateAirDensity(59, station) / calculateAirDensity(59, 29.92);
    expect(ratio).toBeCloseTo(sensorHpa / 1013.25, 3);
  });

  it('averages the samples it is given', () => {
    expect(stationPressureFromSensor([1012, 1013, 1014], 0)).toBeCloseTo(hPaToInHg(1013), 2);
  });

  it('rounds to the hundredth the pressure field shows', () => {
    // 1000 hPa is 29.52998... inHg.
    expect(stationPressureFromSensor([1000], 0)).toBe(29.53);
  });

  it('adds the calibration offset after converting, in inHg', () => {
    expect(stationPressureFromSensor([1000], 0.05)).toBe(29.58);
    expect(stationPressureFromSensor([1000], -0.03)).toBe(29.5);
  });

  it('returns null when there is nothing to average', () => {
    expect(stationPressureFromSensor([], 0)).toBeNull();
  });

  it('ignores samples that are not finite numbers', () => {
    expect(stationPressureFromSensor([NaN, 1000, Infinity], 0)).toBe(29.53);
    expect(stationPressureFromSensor([NaN], 0)).toBeNull();
  });

  it('returns null for a reading outside the range a snapshot can store', () => {
    // EnvironmentSnapshot accepts 20-35 inHg. A sensor that reports 0 or a
    // pressurised-cabin figure is faulty, not informative; filling the field
    // with it would only fail validation on save.
    expect(stationPressureFromSensor([0], 0)).toBeNull();
    expect(stationPressureFromSensor([600], 0)).toBeNull(); // 17.7 inHg
    expect(stationPressureFromSensor([1250], 0)).toBeNull(); // 36.9 inHg
  });

  it('judges the range after calibration, since that is the value that is saved', () => {
    // 677.5 hPa is 20.01 inHg: in range raw, out of range once 0.05 is taken off.
    expect(stationPressureFromSensor([677.5], 0)).toBe(20.01);
    expect(stationPressureFromSensor([677.5], -0.05)).toBeNull();
  });
});

describe('isValidBarometerOffset', () => {
  it('accepts zero and anything up to the limit either way', () => {
    expect(isValidBarometerOffset(0)).toBe(true);
    expect(isValidBarometerOffset(MAX_BAROMETER_OFFSET_INHG)).toBe(true);
    expect(isValidBarometerOffset(-MAX_BAROMETER_OFFSET_INHG)).toBe(true);
    expect(isValidBarometerOffset(0.04)).toBe(true);
  });

  it('rejects an offset larger than any working sensor could need', () => {
    // A phone barometer is good to a hPa or two (~0.03-0.06 inHg). An offset of
    // an inch of mercury is a thousand feet of altitude: past that it is a typed
    // altimeter setting, not a calibration.
    expect(MAX_BAROMETER_OFFSET_INHG).toBe(1);
    expect(isValidBarometerOffset(1.01)).toBe(false);
    expect(isValidBarometerOffset(-1.01)).toBe(false);
  });

  it('rejects values that are not finite numbers', () => {
    expect(isValidBarometerOffset(NaN)).toBe(false);
    expect(isValidBarometerOffset(Infinity)).toBe(false);
  });
});
