import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// eslint-disable-next-line import/no-unresolved

import { DashboardScreen } from '../screens/DashboardScreen';

import { AmmoNavigator } from './AmmoNavigator';
import { CalculatorNavigator } from './CalculatorNavigator';
import { HistoryNavigator } from './HistoryNavigator';
import { RiflesNavigator } from './RiflesNavigator';
import { SessionNavigator } from './SessionNavigator';

import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TabNavigator: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#B0B0B0',
        tabBarStyle: {
          backgroundColor: '#2a2a2a',
          borderTopColor: '#404040',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryNavigator}
        options={{
          tabBarLabel: 'Logs',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
          lazy: false,
        }}
      />
      <Tab.Screen
        name="Calculator"
        component={CalculatorNavigator}
        options={{
          tabBarLabel: 'Calc',
          tabBarIcon: ({ color, size }) => <Ionicons name="calculator" size={size} color={color} />,
          lazy: false,
        }}
      />
      <Tab.Screen
        name="Rifles"
        component={RiflesNavigator}
        options={{
          tabBarLabel: 'Rifles',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="crosshairs-gps" size={size} color={color} />
          ),
          lazy: false,
        }}
      />
      <Tab.Screen
        name="Ammo"
        component={AmmoNavigator}
        options={{
          tabBarLabel: 'Ammo',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bullet" size={size} color={color} />
          ),
          lazy: false,
        }}
      />
      <Tab.Screen
        name="Session"
        component={SessionNavigator}
        options={{
          // It opens the range-session stack. It said "Weather" with a cloud
          // icon from dadf991 until #131.
          tabBarLabel: 'Session',
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
          lazy: false,
        }}
      />
    </Tab.Navigator>
  );
};
