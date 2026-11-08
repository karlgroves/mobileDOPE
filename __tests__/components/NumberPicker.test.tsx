import { fireEvent } from '@testing-library/react-native';
import React from 'react';
import { FlatList } from 'react-native';

import { NumberPicker } from '../../src/components/NumberPicker';
import { DEFAULT_DISTANCE_PRESETS } from '../../src/utils/distancePresets';
import { renderWithProviders as render } from '../helpers/renderWithProviders';

const open = (value: number | undefined) => {
  const utils = render(
    <NumberPicker
      label="Distance"
      value={value}
      onValueChange={jest.fn()}
      min={25}
      max={2000}
      step={25}
      unit="yards"
      presets={DEFAULT_DISTANCE_PRESETS}
    />
  );
  fireEvent.press(utils.getByRole('button', { name: /^Distance:/ }));
  return utils;
};

describe('NumberPicker (#227)', () => {
  it('opens the list at the selected value', () => {
    expect(open(650).UNSAFE_getByType(FlatList).props.initialScrollIndex).toBe(
      DEFAULT_DISTANCE_PRESETS.indexOf(650)
    );
  });

  it('opens at the top when nothing, or the first value, is selected', () => {
    expect(open(undefined).UNSAFE_getByType(FlatList).props.initialScrollIndex).toBeUndefined();
    expect(open(100).UNSAFE_getByType(FlatList).props.initialScrollIndex).toBeUndefined();
  });

  it('opens at the nearest row when the value is not in the list', () => {
    expect(open(333).UNSAFE_getByType(FlatList).props.initialScrollIndex).toBe(
      DEFAULT_DISTANCE_PRESETS.indexOf(325)
    );
    expect(open(1200).UNSAFE_getByType(FlatList).props.initialScrollIndex).toBe(
      DEFAULT_DISTANCE_PRESETS.length - 1
    );
    expect(open(50).UNSAFE_getByType(FlatList).props.initialScrollIndex).toBeUndefined();
  });

  it('offers 25-yard steps from the shipped presets', () => {
    const { getByRole } = open(undefined);
    expect(getByRole('radio', { name: '125 yards' })).toBeTruthy();
    expect(getByRole('radio', { name: '150 yards' })).toBeTruthy();
  });
});
