import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '../contexts/ThemeContext';
import { EnvironmentInput } from '../screens/EnvironmentInput';
import { RangeSessionActive } from '../screens/RangeSessionActive';
import { RangeSessionStart } from '../screens/RangeSessionStart';
import { RangeSessionSummary } from '../screens/RangeSessionSummary';

import { stackHeaderOptions } from './navigationTheme';

import type { SessionStackParamList } from './types';

const Stack = createNativeStackNavigator<SessionStackParamList>();

export const SessionNavigator: React.FC = () => {
  const { colors } = useTheme().theme;

  return (
    <Stack.Navigator
      screenOptions={{
        ...stackHeaderOptions(colors),
      }}
    >
      <Stack.Screen
        name="RangeSessionStart"
        component={RangeSessionStart}
        options={{ title: 'Start Session' }}
      />
      <Stack.Screen
        name="RangeSessionActive"
        component={RangeSessionActive}
        options={{
          title: 'Range Session',
          headerBackVisible: false, // Prevent accidental back during active session
        }}
      />
      <Stack.Screen
        name="RangeSessionSummary"
        component={RangeSessionSummary}
        options={{
          title: 'Session Summary',
          headerBackVisible: false, // User must choose to start new or go back explicitly
        }}
      />
      <Stack.Screen
        name="EnvironmentInput"
        component={EnvironmentInput}
        options={{ title: 'Environmental Data' }}
      />
    </Stack.Navigator>
  );
};
