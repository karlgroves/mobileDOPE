import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef } from 'react';
import { Linking } from 'react-native';

import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

import { linking, restoredInitialState } from './linking';
import { TabNavigator } from './TabNavigator';

import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const NAVIGATION_PERSISTENCE_KEY = '@mobileDOPE:navigation_state';

export const RootNavigator: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState<any | undefined>(undefined);
  const routeNameRef = useRef<string | undefined>(undefined);
  const navigationRef = useRef<any | undefined>(undefined);

  useEffect(() => {
    const restoreState = async () => {
      try {
        // Deliberately not just "read the saved state". NavigationContainer
        // prefers the `initialState` prop over the state it derives from an
        // incoming URL, so restoring unconditionally would swallow every
        // cold-start deep link -- the user taps a link to one log and lands on
        // whatever screen they last closed. See restoredInitialState (#65).
        const state = await restoredInitialState(
          () => Linking.getInitialURL(),
          () => AsyncStorage.getItem(NAVIGATION_PERSISTENCE_KEY)
        );

        if (state !== undefined) {
          setInitialState(state);
        }
      } catch (error) {
        console.error('Failed to restore navigation state:', error);
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      initialState={initialState}
      onStateChange={async (state) => {
        try {
          await AsyncStorage.setItem(NAVIGATION_PERSISTENCE_KEY, JSON.stringify(state));
        } catch (error) {
          console.error('Failed to save navigation state:', error);
        }
      }}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Settings',
            headerStyle: {
              backgroundColor: '#2a2a2a',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={PrivacyPolicyScreen}
          options={{
            headerShown: true,
            title: 'Privacy Policy',
            headerStyle: {
              backgroundColor: '#2a2a2a',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: 'bold',
              fontSize: 18,
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
