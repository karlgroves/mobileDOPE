import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '../contexts/ThemeContext';
import { AllAmmoProfileList } from '../screens/AllAmmoProfileList';
import { AmmoCompare } from '../screens/AmmoCompare';
import { AmmoProfileDetail } from '../screens/AmmoProfileDetail';
import { AmmoProfileForm } from '../screens/AmmoProfileForm';
import { ChronographInput } from '../screens/ChronographInput';
import { DOPECardGenerator } from '../screens/DOPECardGenerator';
import { ShotStringHistory } from '../screens/ShotStringHistory';

import { stackHeaderOptions } from './navigationTheme';

import type { AmmoStackParamList } from './types';

const Stack = createNativeStackNavigator<AmmoStackParamList>();

export const AmmoNavigator: React.FC = () => {
  const { colors } = useTheme().theme;

  return (
    <Stack.Navigator
      screenOptions={{
        ...stackHeaderOptions(colors),
      }}
    >
      <Stack.Screen
        name="AllAmmoProfileList"
        component={AllAmmoProfileList}
        options={{ title: 'All Ammunition' }}
      />
      <Stack.Screen
        name="AmmoProfileForm"
        component={AmmoProfileForm}
        options={({ route }) => ({
          title: route.params?.ammoId ? 'Edit Ammo Profile' : 'New Ammo Profile',
        })}
      />
      <Stack.Screen
        name="AmmoProfileDetail"
        component={AmmoProfileDetail}
        options={{ title: 'Ammo Profile' }}
      />
      <Stack.Screen
        name="DOPECardGenerator"
        // @ts-expect-error - DOPECardGenerator typed for ProfilesStack but params are compatible
        component={DOPECardGenerator}
        options={{ title: 'DOPE Card Generator' }}
      />
      <Stack.Screen
        name="ChronographInput"
        component={ChronographInput}
        options={{ title: 'Chronograph' }}
      />
      <Stack.Screen
        name="ShotStringHistory"
        component={ShotStringHistory}
        options={{ title: 'Velocity History' }}
      />
      <Stack.Screen
        name="AmmoCompare"
        component={AmmoCompare}
        options={{ title: 'Compare Ammunition' }}
      />
    </Stack.Navigator>
  );
};
