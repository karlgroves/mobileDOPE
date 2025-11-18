import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BallisticCalculator } from '../screens/BallisticCalculator';
import { WindTable } from '../screens/WindTable';
import type { CalculatorStackParamList } from './types';

const Stack = createNativeStackNavigator<CalculatorStackParamList>();

export const CalculatorNavigator: React.FC = () => {
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
        name="BallisticCalculator"
        component={BallisticCalculator}
        options={{ title: 'Ballistic Calculator' }}
      />
      <Stack.Screen
        name="WindTable"
        component={WindTable}
        options={{ title: 'Wind Table' }}
      />
    </Stack.Navigator>
  );
};
