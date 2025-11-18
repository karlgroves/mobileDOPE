import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogsScreen } from '../screens/LogsScreen';
import type { LogsStackParamList } from './types';

const Stack = createNativeStackNavigator<LogsStackParamList>();

export const LogsNavigator: React.FC = () => {
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
        name="DOPELogList"
        component={LogsScreen}
        options={{ title: 'DOPE Logs' }}
      />
    </Stack.Navigator>
  );
};
