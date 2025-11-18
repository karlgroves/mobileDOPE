import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RangeScreen } from '../screens/RangeScreen';
import type { RangeStackParamList } from './types';

const Stack = createNativeStackNavigator<RangeStackParamList>();

export const RangeNavigator: React.FC = () => {
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
        component={RangeScreen}
        options={{ title: 'Range Session' }}
      />
    </Stack.Navigator>
  );
};
