import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { TextInput } from '../../src/components/TextInput';
import { theme } from '../../src/constants/theme';
import { ThemeProvider } from '../../src/contexts/ThemeContext';

// Wrapper component to provide theme context
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('TextInput Component', () => {
  it('should render with label', () => {
    const { getByText } = render(
      <TextInput label="Rifle Name" value="" onChangeText={() => {}} />,
      { wrapper: Wrapper }
    );

    expect(getByText('Rifle Name')).toBeTruthy();
  });

  it('should render with placeholder', () => {
    const { getByPlaceholderText } = render(
      <TextInput
        label="Rifle Name"
        placeholder="Enter rifle name"
        value=""
        onChangeText={() => {}}
      />,
      { wrapper: Wrapper }
    );

    expect(getByPlaceholderText('Enter rifle name')).toBeTruthy();
  });

  it('should call onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <TextInput
        label="Rifle Name"
        placeholder="Enter name"
        value=""
        onChangeText={onChangeText}
      />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter name');
    fireEvent.changeText(input, 'My Rifle');

    expect(onChangeText).toHaveBeenCalledWith('My Rifle');
  });

  it('should display current value', () => {
    const { getByDisplayValue } = render(
      <TextInput label="Rifle Name" value="Test Rifle" onChangeText={() => {}} />,
      { wrapper: Wrapper }
    );

    expect(getByDisplayValue('Test Rifle')).toBeTruthy();
  });

  it('should render error message when provided', () => {
    const { getByText } = render(
      <TextInput label="Rifle Name" value="" onChangeText={() => {}} error="Name is required" />,
      { wrapper: Wrapper }
    );

    expect(getByText('Name is required')).toBeTruthy();
  });

  it('should apply error styling when error is present', () => {
    const { getByPlaceholderText } = render(
      <TextInput
        label="Rifle Name"
        placeholder="Enter name"
        value=""
        onChangeText={() => {}}
        error="Required"
      />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter name');
    // React Native passes `style` through as an array of style objects, so flatten to
    // the effective style before asserting. Asserting the error colour specifically
    // (rather than `expect.any(String)`) is what makes this test able to fail: every
    // state of this input sets *some* borderColor.
    expect(StyleSheet.flatten(input.props.style)).toMatchObject({
      borderColor: theme.colors.error,
    });
  });

  it('should render with helper text', () => {
    const { getByText } = render(
      <TextInput
        label="Caliber"
        value=""
        onChangeText={() => {}}
        helperText="e.g., .308 Winchester"
      />,
      { wrapper: Wrapper }
    );

    expect(getByText('e.g., .308 Winchester')).toBeTruthy();
  });

  it('should support multiline input', () => {
    const { getByPlaceholderText } = render(
      <TextInput
        label="Notes"
        placeholder="Enter notes"
        value=""
        onChangeText={() => {}}
        multiline
        numberOfLines={4}
      />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter notes');
    expect(input.props.multiline).toBe(true);
    expect(input.props.numberOfLines).toBe(4);
  });

  it('should be disabled when disabled prop is true', () => {
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(
      <TextInput
        label="Rifle Name"
        placeholder="Enter name"
        value=""
        onChangeText={onChangeText}
        disabled
      />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter name');
    expect(input.props.editable).toBe(false);
  });

  it('should support different keyboard types', () => {
    const { getByPlaceholderText } = render(
      <TextInput
        label="Email"
        placeholder="Enter email"
        value=""
        onChangeText={() => {}}
        keyboardType="email-address"
      />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter email');
    expect(input.props.keyboardType).toBe('email-address');
  });

  it('should support autocapitalization', () => {
    const { getByPlaceholderText } = render(
      <TextInput
        label="Name"
        placeholder="Enter name"
        value=""
        onChangeText={() => {}}
        autoCapitalize="words"
      />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter name');
    expect(input.props.autoCapitalize).toBe('words');
  });

  it('should support secure text entry for passwords', () => {
    const { getByPlaceholderText } = render(
      <TextInput
        label="Password"
        placeholder="Enter password"
        value=""
        onChangeText={() => {}}
        secureTextEntry
      />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('should render with required indicator', () => {
    const { getByText } = render(
      <TextInput label="Rifle Name" value="" onChangeText={() => {}} required />,
      { wrapper: Wrapper }
    );

    expect(getByText('Rifle Name *')).toBeTruthy();
  });

  it('should support maxLength prop', () => {
    const { getByPlaceholderText } = render(
      <TextInput
        label="Code"
        placeholder="Enter code"
        value=""
        onChangeText={() => {}}
        maxLength={10}
      />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter code');
    expect(input.props.maxLength).toBe(10);
  });

  it('should render with large touch target for field use', () => {
    const { getByPlaceholderText } = render(
      <TextInput label="Rifle Name" placeholder="Enter name" value="" onChangeText={() => {}} />,
      { wrapper: Wrapper }
    );

    const input = getByPlaceholderText('Enter name');
    // Minimum touch target should be 44pt (per accessibility guidelines).
    // `style` arrives as an array, so flatten first. Assert the actual guarantee rather
    // than `expect.any(Number)`, which would pass for a 1pt-tall input.
    const { minHeight } = StyleSheet.flatten(input.props.style);
    expect(minHeight).toBeGreaterThanOrEqual(theme.touchTargets.min);
  });

  describe('accessible name', () => {
    // React Native does not link the visible label to the field, so without an
    // explicit name the input announces as "text field". See issue #30.
    it('names the field from its visible label', () => {
      const { getByLabelText } = render(
        <TextInput label="Muzzle Velocity" value="" onChangeText={jest.fn()} />,
        { wrapper: Wrapper }
      );
      expect(getByLabelText('Muzzle Velocity')).toBeTruthy();
    });

    it('announces that a required field is required', () => {
      const { getByLabelText } = render(
        <TextInput label="Ammo Name" value="" onChangeText={jest.fn()} required />,
        { wrapper: Wrapper }
      );
      expect(getByLabelText('Ammo Name, required')).toBeTruthy();
    });

    it('prefers an explicit accessibilityLabel over the visible label', () => {
      // The quality bar for this app: a terse visible label needs a spoken form
      // that carries the unit and the axis.
      const { getByLabelText } = render(
        <TextInput
          label="MV"
          accessibilityLabel="Muzzle velocity, feet per second"
          value=""
          onChangeText={jest.fn()}
        />,
        { wrapper: Wrapper }
      );
      expect(getByLabelText('Muzzle velocity, feet per second')).toBeTruthy();
    });

    it('reads the error out with the field rather than as a stray sibling', () => {
      const { getByLabelText } = render(
        <TextInput label="Ammo Name" value="" onChangeText={jest.fn()} error="Name is required" />,
        { wrapper: Wrapper }
      );
      expect(getByLabelText('Ammo Name').props.accessibilityHint).toBe('Name is required');
    });

    it('falls back to helper text for the hint when there is no error', () => {
      const { getByLabelText } = render(
        <TextInput
          label="Lot Number"
          value=""
          onChangeText={jest.fn()}
          helperText="Optional: manufacturer lot number"
        />,
        { wrapper: Wrapper }
      );
      expect(getByLabelText('Lot Number').props.accessibilityHint).toBe(
        'Optional: manufacturer lot number'
      );
    });
  });
});
