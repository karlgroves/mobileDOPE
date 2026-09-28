import React from 'react';

import { LoadingSpinner } from '../../src/components/LoadingSpinner';
import { renderWithProviders } from '../helpers/renderWithProviders';

describe('LoadingSpinner', () => {
  it('should render ActivityIndicator', () => {
    const { getByTestId } = renderWithProviders(<LoadingSpinner testID="spinner" />);
    expect(getByTestId('spinner')).toBeTruthy();
  });

  it('should render with message when provided', () => {
    const { getByText } = renderWithProviders(<LoadingSpinner message="Loading data..." />);
    expect(getByText('Loading data...')).toBeTruthy();
  });

  it('should not render message when not provided', () => {
    const { queryByText } = renderWithProviders(<LoadingSpinner />);
    expect(queryByText(/./)).toBeNull();
  });

  it('should apply custom size', () => {
    const { getByTestId } = renderWithProviders(<LoadingSpinner size="small" testID="spinner" />);
    const spinner = getByTestId('spinner');
    expect(spinner.props.size).toBe('small');
  });

  it('should use default size when not specified', () => {
    const { getByTestId } = renderWithProviders(<LoadingSpinner testID="spinner" />);
    const spinner = getByTestId('spinner');
    expect(spinner.props.size).toBe('large');
  });

  it('should apply custom color', () => {
    const customColor = '#FF0000';
    const { getByTestId } = renderWithProviders(
      <LoadingSpinner color={customColor} testID="spinner" />
    );
    const spinner = getByTestId('spinner');
    expect(spinner.props.color).toBe(customColor);
  });
});
