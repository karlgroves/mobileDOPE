import { fireEvent } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { renderWithProviders } from '../helpers/renderWithProviders';

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>No error</Text>;
};

// Suppress console.error for these tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    const { getByText } = renderWithProviders(
      <ErrorBoundary>
        <Text>Test Content</Text>
      </ErrorBoundary>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('should render error UI when an error occurs', () => {
    const { getByText } = renderWithProviders(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('should show error message in error UI', () => {
    const { getByText } = renderWithProviders(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText(/Test error/)).toBeTruthy();
  });

  it('Try Again clears the error and renders the children again', () => {
    // The child throws until the test clears the flag. The boundary keeps its
    // fallback up after that unless Try Again really resets it -- a no-op reset
    // leaves 'Something went wrong' on screen.
    let broken = true;
    const Flaky: React.FC = () => {
      if (broken) throw new Error('Test error');
      return <Text>Recovered</Text>;
    };
    const { getByText, queryByText } = renderWithProviders(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>
    );
    expect(getByText('Something went wrong')).toBeTruthy();

    broken = false;
    fireEvent.press(getByText('Try Again'));

    expect(getByText('Recovered')).toBeTruthy();
    expect(queryByText('Something went wrong')).toBeNull();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <Text>Custom Error Message</Text>;
    const { getByText } = renderWithProviders(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Custom Error Message')).toBeTruthy();
  });
});
