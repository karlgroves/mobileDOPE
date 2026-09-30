import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '../contexts/ThemeContext';
import { AmmoProfileDetail } from '../screens/AmmoProfileDetail';
import { AmmoProfileForm } from '../screens/AmmoProfileForm';
import { AmmoProfileList } from '../screens/AmmoProfileList';
import { ChronographInput } from '../screens/ChronographInput';
import { DOPECardGenerator } from '../screens/DOPECardGenerator';
import { RifleProfileDetail } from '../screens/RifleProfileDetail';
import { RifleProfileForm } from '../screens/RifleProfileForm';
import { RifleProfileList } from '../screens/RifleProfileList';
import { ShotStringHistory } from '../screens/ShotStringHistory';

import { stackHeaderOptions } from './navigationTheme';

import type { RiflesStackParamList } from './types';

const Stack = createNativeStackNavigator<RiflesStackParamList>();

export const RiflesNavigator: React.FC = () => {
  const { colors } = useTheme().theme;

  return (
    <Stack.Navigator
      screenOptions={{
        ...stackHeaderOptions(colors),
      }}
    >
      <Stack.Screen
        name="RifleProfileList"
        component={RifleProfileList}
        options={{ title: 'Rifle Profiles' }}
      />
      <Stack.Screen
        name="RifleProfileForm"
        component={RifleProfileForm}
        options={({ route }) => ({
          title: route.params?.rifleId ? 'Edit Rifle Profile' : 'New Rifle Profile',
        })}
      />
      <Stack.Screen
        name="RifleProfileDetail"
        component={RifleProfileDetail}
        options={{ title: 'Rifle Profile' }}
      />
      <Stack.Screen
        name="AmmoProfileList"
        component={AmmoProfileList}
        options={{ title: 'Ammunition Profiles' }}
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
    </Stack.Navigator>
  );
};
