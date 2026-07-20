import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingSpinner } from '../../src/components/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render ActivityIndicator', () => {
    const { getByTestId } = render(<LoadingSpinner testID="spinner" />);
    expect(getByTestId('spinner')).toBeTruthy();
  });

  it('should render with message when provided', () => {
    const { getByText } = render(<LoadingSpinner message="Loading data..." />);
    expect(getByText('Loading data...')).toBeTruthy();
  });

  it('should not render message when not provided', () => {
    const { queryByText } = render(<LoadingSpinner />);
    expect(queryByText(/./)).toBeNull();
  });

  it('should apply custom size', () => {
    const { getByTestId } = render(<LoadingSpinner size="small" testID="spinner" />);
    const spinner = getByTestId('spinner');
    expect(spinner.props.size).toBe('small');
  });

  it('should use default size when not specified', () => {
    const { getByTestId } = render(<LoadingSpinner testID="spinner" />);
    const spinner = getByTestId('spinner');
    expect(spinner.props.size).toBe('large');
  });

  it('should apply custom color', () => {
    const customColor = '#FF0000';
    const { getByTestId } = render(<LoadingSpinner color={customColor} testID="spinner" />);
    const spinner = getByTestId('spinner');
    expect(spinner.props.color).toBe(customColor);
  });
});
