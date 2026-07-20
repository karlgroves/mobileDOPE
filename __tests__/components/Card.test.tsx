import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Card } from '../../src/components/Card';

describe('Card', () => {
  it('should render children correctly', () => {
    const { getByText } = render(
      <Card>
        <Text>Test Content</Text>
      </Card>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('should apply custom style', () => {
    const customStyle = { backgroundColor: '#FF0000' };
    const { getByTestId } = render(
      <Card style={customStyle} testID="card">
        <Text>Content</Text>
      </Card>
    );

    const card = getByTestId('card');
    expect(card.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining(customStyle)])
    );
  });

  it('should handle press events when onPress is provided', () => {
    const onPressMock = jest.fn();
    const { getByTestId } = render(
      <Card onPress={onPressMock} testID="card">
        <Text>Pressable Card</Text>
      </Card>
    );

    const card = getByTestId('card');
    expect(card.props.accessible).toBe(true);
  });

  it('should not be pressable when onPress is not provided', () => {
    const { getByTestId } = render(
      <Card testID="card">
        <Text>Non-pressable Card</Text>
      </Card>
    );

    const card = getByTestId('card');
    // When not pressable, it should be a View, not a Pressable
    expect(card.type).toBe('View');
  });
});
