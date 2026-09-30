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

  describe('the error message', () => {
    // React Native's build flag; the global is not a name this codebase chose.
    const DEV_FLAG = '__DEV__';
    const setDev = (value: boolean): void => {
      Object.defineProperty(globalThis, DEV_FLAG, { value, configurable: true, writable: true });
    };
    const dev = Reflect.get(globalThis, DEV_FLAG) as boolean;
    afterEach(() => setDev(dev));

    it('is shown in a development build, where it helps', () => {
      setDev(true);
      const { getByText } = renderWithProviders(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText(/Test error/)).toBeTruthy();
    });

    it('is not shown to a shooter in a release build', () => {
      // "Cannot read property 'toFixed' of null" means nothing to them, and the
      // boundary is now mounted around every screen.
      setDev(false);
      const { getByText, queryByText } = renderWithProviders(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(getByText('Something went wrong')).toBeTruthy();
      expect(queryByText(/Test error/)).toBeNull();
    });
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

  it('reports what it caught through onError', () => {
    const onError = jest.fn();

    renderWithProviders(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toEqual(expect.objectContaining({ message: 'Test error' }));
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
