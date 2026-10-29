import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { BarrelStateNotice } from '../../src/components/BarrelStateNotice';
import { MIN_BIAS_SAMPLES, MIN_HEAT_SHIFT_SHOTS } from '../../src/utils/barrelStateAnalysis';
import { renderWithProviders } from '../helpers/renderWithProviders';

import type { BarrelStateResult } from '../../src/hooks/useBarrelState';

/**
 * The barrel-state card (#165).
 *
 * The arithmetic is in `barrelStateAnalysis.test.ts` and the per-log offsets in
 * `useBarrelState.test.tsx`. What is asserted here is the part those cannot
 * see: that neither correction is applied unless the shooter turns it on, and
 * that with too little data the card says what is missing rather than vanishing.
 */

const nothing: BarrelStateResult = {
  analysis: { coldBore: undefined, heatShift: undefined },
  coldBoreModelled: true,
  heatShiftModelled: true,
  loading: false,
};

const measured: BarrelStateResult = {
  analysis: {
    coldBore: { bias: 0.15, coldSamples: 4, warmSamples: 6 },
    heatShift: { perShot: 0.02, shots: 20 },
  },
  coldBoreCaption: 'Expected cold-bore shift: 0.15 MIL low',
  heatShiftCaption: 'Barrel heating: 0.20 MIL low expected by shot 11',
  coldBoreCorrection: 0.15,
  heatShiftCorrection: 0.2,
  coldBoreModelled: true,
  heatShiftModelled: true,
  loading: false,
};

const render = (
  state: BarrelStateResult,
  over: Partial<React.ComponentProps<typeof BarrelStateNotice>> = {}
) =>
  renderWithProviders(
    <BarrelStateNotice
      state={state}
      applyColdBore={false}
      onApplyColdBoreChange={jest.fn()}
      applyHeatShift={false}
      onApplyHeatShiftChange={jest.fn()}
      isColdBoreShot
      unit="MIL"
      testID="barrel-state"
      {...over}
    />
  );

describe('BarrelStateNotice with measured figures (#165)', () => {
  it('states the cold-bore shift in the words the issue asked for', () => {
    const { getByTestId } = render(measured);

    expect(getByTestId('cold-bore-caption').props.children).toBe(
      'Expected cold-bore shift: 0.15 MIL low'
    );
  });

  it('states the heat shift', () => {
    const { getByTestId } = render(measured);

    expect(getByTestId('heat-shift-caption').props.children).toBe(
      'Barrel heating: 0.20 MIL low expected by shot 11'
    );
  });

  it('offers both corrections off, so neither is applied without being chosen', () => {
    const { getByTestId } = render(measured);

    expect(getByTestId('apply-cold-bore').props.value).toBe(false);
    expect(getByTestId('apply-heat-shift').props.value).toBe(false);
  });

  it('reports the shooter turning each one on', () => {
    const onColdBore = jest.fn();
    const onHeatShift = jest.fn();
    const { getByTestId } = render(measured, {
      onApplyColdBoreChange: onColdBore,
      onApplyHeatShiftChange: onHeatShift,
    });

    fireEvent(getByTestId('apply-cold-bore'), 'valueChange', true);
    fireEvent(getByTestId('apply-heat-shift'), 'valueChange', true);

    expect(onColdBore).toHaveBeenCalledWith(true);
    expect(onHeatShift).toHaveBeenCalledWith(true);
  });

  it('still shows the cold-bore figure past the first shot, with no switch', () => {
    // Worth knowing that the rifle throws its first shot low even at shot six.
    // Dialling it then would be correcting for a condition that has passed.
    const { getByTestId, queryByTestId } = render(measured, { isColdBoreShot: false });

    expect(getByTestId('cold-bore-past').props.children).toContain('no longer cold');
    expect(queryByTestId('apply-cold-bore')).toBeNull();
  });
});

describe('BarrelStateNotice with too little data (#165)', () => {
  it('says what the cold-bore bias is waiting for, rather than vanishing', () => {
    // An absent section reads as "your barrel does not do this", which the
    // shooter cannot tell from "nobody has recorded enough to say".
    const { getByTestId } = render(nothing);

    const text = getByTestId('cold-bore-short').props.children;
    expect(text).toContain(String(MIN_BIAS_SAMPLES));
    expect(text).toContain('cold-bore shots');
  });

  it('says what the heat shift is waiting for', () => {
    const { getByTestId } = render(nothing);

    expect(getByTestId('heat-shift-short').props.children).toContain(String(MIN_HEAT_SHIFT_SHOTS));
  });

  it('offers no switches at all when there is nothing to apply', () => {
    const { queryByTestId } = render(nothing);

    expect(queryByTestId('apply-cold-bore')).toBeNull();
    expect(queryByTestId('apply-heat-shift')).toBeNull();
  });

  it('distinguishes a fitted-but-flat slope from no slope at all', () => {
    // A slope was fitted and came out below the threshold. That is a different
    // statement from "not enough shots to fit one", and the shooter is entitled
    // to the difference.
    const { getByTestId } = render({
      ...nothing,
      analysis: { coldBore: undefined, heatShift: { perShot: 0.0001, shots: 20 } },
    });

    expect(getByTestId('heat-shift-short').props.children).toContain('holds steady');
  });
});

describe('BarrelStateNotice with modelling switched off in Settings (#167)', () => {
  it('says cold-bore modelling is off rather than that data is short', () => {
    const { getByTestId, queryByTestId } = render({
      ...nothing,
      coldBoreModelled: false,
      heatShiftModelled: true,
    });

    expect(getByTestId('cold-bore-off')).toBeTruthy();
    expect(queryByTestId('cold-bore-short')).toBeNull();
    expect(queryByTestId('apply-cold-bore')).toBeNull();
    expect(getByTestId('heat-shift-short')).toBeTruthy();
  });

  it('says heat-shift modelling is off rather than that data is short', () => {
    const { getByTestId, queryByTestId } = render({
      ...nothing,
      coldBoreModelled: true,
      heatShiftModelled: false,
    });

    expect(getByTestId('heat-shift-off')).toBeTruthy();
    expect(queryByTestId('heat-shift-short')).toBeNull();
    expect(queryByTestId('apply-heat-shift')).toBeNull();
    expect(getByTestId('cold-bore-short')).toBeTruthy();
  });
});

describe('BarrelStateNotice while loading (#165)', () => {
  it('says it is reading rather than claiming there is no history', () => {
    const { getByText, queryByTestId } = render({ ...nothing, loading: true });

    expect(getByText(/Reading your barrel-state history/)).toBeTruthy();
    expect(queryByTestId('cold-bore-short')).toBeNull();
  });
});
