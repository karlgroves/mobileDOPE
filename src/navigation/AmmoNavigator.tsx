import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AllAmmoProfileList } from '../screens/AllAmmoProfileList';
import { AmmoProfileForm } from '../screens/AmmoProfileForm';
import { AmmoProfileDetail } from '../screens/AmmoProfileDetail';
import type { AmmoStackParamList } from './types';

const Stack = createNativeStackNavigator<AmmoStackParamList>();

export const AmmoNavigator: React.FC = () => {
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
    </Stack.Navigator>
  );
};
