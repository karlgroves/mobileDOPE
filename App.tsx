import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';

import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { databaseService, migrationRunner } from './src/services/database';
import { useAppStore } from './src/store';

function AppContent() {
  const {
    isInitialized,
    setInitialized,
    setDatabaseReady,
    error,
    setError,
    settings,
    loadSettings,
  } = useAppStore();
  // AppContent sits inside ThemeProvider, so the startup screens follow the
  // saved theme like everything after them (#116).
  const { colors } = useTheme().theme;

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load settings from AsyncStorage
        await loadSettings();
        console.log('Settings loaded');

        // Initialize database
        await databaseService.initialize();
        console.log('Database initialized');

        // Run migrations
        await migrationRunner.runPendingMigrations();
        console.log('Migrations completed');

        setDatabaseReady(true);
        setInitialized(true);
      } catch (err) {
        console.error('App initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize app');
      }
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDark = settings.themeMode === 'dark' || settings.themeMode === 'nightVision';

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.errorText }]}>Error: {error}</Text>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text.primary }]}>Initializing...</Text>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 24,
  },
});
