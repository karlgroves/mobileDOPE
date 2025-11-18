import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAppStore } from './src/store';
import { databaseService, migrationRunner } from './src/services/database';

export default function App() {
  const { isInitialized, setInitialized, setDatabaseReady, error, setError } = useAppStore();

  useEffect(() => {
    const initializeApp = async () => {
      try {
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
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Initializing...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <RootNavigator />
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    padding: 24,
  },
});
