import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RangeSessionStart } from '../screens/RangeSessionStart';
import { RangeSessionActive } from '../screens/RangeSessionActive';
import { RangeSessionSummary } from '../screens/RangeSessionSummary';
import { EnvironmentInput } from '../screens/EnvironmentInput';
import type { SessionStackParamList } from './types';

const Stack = createNativeStackNavigator<SessionStackParamList>();

export const SessionNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2a2a2a',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
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
