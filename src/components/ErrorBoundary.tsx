import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { Sizes } from '../constants/sizes';
import { Typography } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';

import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called once with the error that was caught, e.g. to clear state that would reproduce it. */
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * The default fallback. A function component so it can read the active theme --
 * the class boundary cannot call useTheme() itself (#116).
 */
const ErrorFallback: React.FC<{ error: Error | null; onReset: () => void }> = ({
  error,
  onReset,
}) => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={[styles.title, { color: colors.text.primary }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: colors.text.secondary }]}>
          An unexpected error occurred. Please try again.
        </Text>
        {error && (
          <View style={[styles.errorDetails, { backgroundColor: colors.surface }]}>
            <Text style={[styles.errorText, { color: colors.errorText }]}>{error.message}</Text>
          </View>
        )}
        <Button title="Try Again" onPress={onReset} variant="primary" style={styles.button} />
      </ScrollView>
    </View>
  );
};

/**
 * Catches render errors below it and shows a recovery screen.
 *
 * Mount it **inside** ThemeProvider: the default fallback reads the theme with
 * useTheme(), which throws outside the provider -- so a boundary wrapped around
 * ThemeProvider would fail while showing its own error screen. To guard the
 * provider itself, pass a `fallback` that does not use the theme.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Sizes.spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: Sizes.spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '600',
    marginBottom: Sizes.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    marginBottom: Sizes.spacing.lg,
  },
  errorDetails: {
    padding: Sizes.spacing.md,
    borderRadius: Sizes.borderRadius.md,
    marginBottom: Sizes.spacing.lg,
    width: '100%',
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: 'monospace',
  },
  button: {
    marginTop: Sizes.spacing.md,
    minWidth: 200,
  },
});
