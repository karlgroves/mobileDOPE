import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RifleProfileList } from '../screens/RifleProfileList';
import { RifleProfileForm } from '../screens/RifleProfileForm';
import { RifleProfileDetail } from '../screens/RifleProfileDetail';
import type { ProfilesStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfilesStackParamList>();

export const ProfilesNavigator: React.FC = () => {
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
    </Stack.Navigator>
  );
};
