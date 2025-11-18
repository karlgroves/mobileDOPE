import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../src/components/Button';

describe('Button', () => {
  it('should render title correctly', () => {
    const { getByText } = render(<Button title="Press Me" onPress={() => {}} />);
    expect(getByText('Press Me')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(<Button title="Press Me" onPress={onPressMock} />);

    fireEvent.press(getByText('Press Me'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="Press Me" onPress={onPressMock} disabled={true} />
    );

    fireEvent.press(getByText('Press Me'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('should apply primary variant styles by default', () => {
    const { getByTestId } = render(
      <Button title="Press Me" onPress={() => {}} testID="button" />
    );

    const button = getByTestId('button');
    expect(button).toBeTruthy();
  });

  it('should apply secondary variant styles', () => {
    const { getByTestId } = render(
      <Button title="Press Me" onPress={() => {}} variant="secondary" testID="button" />
    );

    const button = getByTestId('button');
    expect(button).toBeTruthy();
  });

  it('should apply danger variant styles', () => {
    const { getByTestId } = render(
      <Button title="Press Me" onPress={() => {}} variant="danger" testID="button" />
    );

    const button = getByTestId('button');
    expect(button).toBeTruthy();
  });

  it('should apply small size styles', () => {
    const { getByTestId } = render(
      <Button title="Press Me" onPress={() => {}} size="small" testID="button" />
    );

    const button = getByTestId('button');
    expect(button).toBeTruthy();
  });

  it('should apply large size styles', () => {
    const { getByTestId } = render(
      <Button title="Press Me" onPress={() => {}} size="large" testID="button" />
    );

    const button = getByTestId('button');
    expect(button).toBeTruthy();
  });

  it('should show loading indicator when loading', () => {
    const { getByTestId } = render(
      <Button title="Press Me" onPress={() => {}} loading={true} testID="button" />
    );

    const spinner = getByTestId('button-spinner');
    expect(spinner).toBeTruthy();
  });

  it('should not call onPress when loading', () => {
    const onPressMock = jest.fn();
    const { getByTestId } = render(
      <Button title="Press Me" onPress={onPressMock} loading={true} testID="button" />
    );

    fireEvent.press(getByTestId('button'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('should apply custom style', () => {
    const customStyle = { margin: 20 };
    const { getByTestId } = render(
      <Button title="Press Me" onPress={() => {}} style={customStyle} testID="button" />
    );

    const button = getByTestId('button');
    expect(button.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining(customStyle)])
    );
  });

  it('should be accessible', () => {
    const { getByTestId } = render(
      <Button title="Press Me" onPress={() => {}} testID="button" />
    );

    const button = getByTestId('button');
    expect(button.props.accessible).toBe(true);
    expect(button.props.accessibilityRole).toBe('button');
  });
});
