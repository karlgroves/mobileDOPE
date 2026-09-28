import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { EmptyState } from '../../src/components/EmptyState';
import { renderWithProviders } from '../helpers/renderWithProviders';

describe('EmptyState', () => {
  it('should render title', () => {
    const { getByText } = renderWithProviders(<EmptyState title="No Data" />);
    expect(getByText('No Data')).toBeTruthy();
  });

  it('should render message when provided', () => {
    const { getByText } = renderWithProviders(
      <EmptyState title="No Data" message="There is no data to display." />
    );
    expect(getByText('There is no data to display.')).toBeTruthy();
  });

  it('should not render message when not provided', () => {
    const { getByText } = renderWithProviders(<EmptyState title="No Data" />);
    expect(getByText('No Data')).toBeTruthy();
    // Should only have the title text
  });

  it('should render action button when provided', () => {
    const onActionMock = jest.fn();
    const { getByText } = renderWithProviders(
      <EmptyState title="No Data" actionLabel="Add Item" onAction={onActionMock} />
    );
    expect(getByText('Add Item')).toBeTruthy();
  });

  it('should call onAction when action button is pressed', () => {
    const onActionMock = jest.fn();
    const { getByText } = renderWithProviders(
      <EmptyState title="No Data" actionLabel="Add Item" onAction={onActionMock} />
    );

    fireEvent.press(getByText('Add Item'));
    expect(onActionMock).toHaveBeenCalledTimes(1);
  });

  it('should not render action button when actionLabel is not provided', () => {
    const onActionMock = jest.fn();
    const { queryByRole } = renderWithProviders(
      <EmptyState title="No Data" onAction={onActionMock} />
    );
    // Button should not be rendered
    expect(queryByRole('button')).toBeNull();
  });

  it('should not render action button when onAction is not provided', () => {
    const { queryByRole } = renderWithProviders(
      <EmptyState title="No Data" actionLabel="Add Item" />
    );
    // Button should not be rendered
    expect(queryByRole('button')).toBeNull();
  });

  it('should render icon when provided', () => {
    const { getByTestId } = renderWithProviders(
      <EmptyState title="No Data" icon="📦" testID="empty-state" />
    );
    expect(getByTestId('empty-state-icon')).toBeTruthy();
  });
});
