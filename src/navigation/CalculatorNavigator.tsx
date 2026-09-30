import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '../contexts/ThemeContext';
import { BallisticCalculator } from '../screens/BallisticCalculator';
import { BallisticSolutionResults } from '../screens/BallisticSolutionResults';
import { MovingTargetCalculator } from '../screens/MovingTargetCalculator';
import { WindTable } from '../screens/WindTable';

import { stackHeaderOptions } from './navigationTheme';

import type { CalculatorStackParamList } from './types';

const Stack = createNativeStackNavigator<CalculatorStackParamList>();

export const CalculatorNavigator: React.FC = () => {
  const { colors } = useTheme().theme;

  return (
    <Stack.Navigator
      screenOptions={{
        ...stackHeaderOptions(colors),
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
