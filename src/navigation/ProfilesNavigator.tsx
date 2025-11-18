import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfilesListScreen } from '../screens/ProfilesListScreen';
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
        name="ProfilesList"
        component={ProfilesListScreen}
        options={{ title: 'Rifle Profiles' }}
      />
    </Stack.Navigator>
  );
};
