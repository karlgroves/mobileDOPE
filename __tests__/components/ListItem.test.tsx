import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ListItem } from '../../src/components/ListItem';

describe('ListItem', () => {
  it('should render title', () => {
    const { getByText } = render(<ListItem title="Test Item" />);
    expect(getByText('Test Item')).toBeTruthy();
  });

  it('should render subtitle when provided', () => {
    const { getByText } = render(
      <ListItem title="Test Item" subtitle="Subtitle text" />
    );
    expect(getByText('Subtitle text')).toBeTruthy();
  });

  it('should render right text when provided', () => {
    const { getByText } = render(
      <ListItem title="Test Item" rightText="100" />
    );
    expect(getByText('100')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <ListItem title="Test Item" onPress={onPressMock} />
    );

    fireEvent.press(getByText('Test Item'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('should not be pressable when onPress is not provided', () => {
    const { getByTestId } = render(
      <ListItem title="Test Item" testID="list-item" />
    );

    const listItem = getByTestId('list-item');
    expect(listItem.type).toBe('View');
  });

  it('should show chevron when onPress is provided', () => {
    const { getByText } = render(
      <ListItem title="Test Item" onPress={() => {}} />
    );
    expect(getByText('›')).toBeTruthy();
  });

  it('should not show chevron when onPress is not provided', () => {
    const { queryByText } = render(<ListItem title="Test Item" />);
    expect(queryByText('›')).toBeNull();
  });

  it('should show separator by default', () => {
    const { getByTestId } = render(
      <ListItem title="Test Item" testID="list-item" />
    );
    const separator = getByTestId('list-item-separator');
    expect(separator).toBeTruthy();
  });

  it('should hide separator when hideSeparator is true', () => {
    const { queryByTestId } = render(
      <ListItem title="Test Item" hideSeparator={true} testID="list-item" />
    );
    expect(queryByTestId('list-item-separator')).toBeNull();
  });
});
