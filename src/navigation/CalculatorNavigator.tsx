import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BallisticCalculator } from '../screens/BallisticCalculator';
import { BallisticSolutionResults } from '../screens/BallisticSolutionResults';
import { WindTable } from '../screens/WindTable';
import { MovingTargetCalculator } from '../screens/MovingTargetCalculator';
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
        name="BallisticSolutionResults"
        component={BallisticSolutionResults}
        options={{ title: 'Ballistic Solution' }}
      />
      <Stack.Screen name="WindTable" component={WindTable} options={{ title: 'Wind Table' }} />
      <Stack.Screen
        name="MovingTargetCalculator"
        component={MovingTargetCalculator}
        options={{ title: 'Moving Target' }}
      />
    </Stack.Navigator>
  );
};
