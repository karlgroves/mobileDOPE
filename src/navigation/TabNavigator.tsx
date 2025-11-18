import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProfilesNavigator } from './ProfilesNavigator';
import { RangeNavigator } from './RangeNavigator';
import { CalculatorNavigator } from './CalculatorNavigator';
import { LogsNavigator } from './LogsNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: '#B0B0B0',
        tabBarStyle: {
          backgroundColor: '#2a2a2a',
          borderTopColor: '#404040',
          height: 60,
          paddingBottom: 8,
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
        }}
      />
      <Tab.Screen
        name="Profiles"
        component={ProfilesNavigator}
        options={{
          tabBarLabel: 'Profiles',
        }}
      />
      <Tab.Screen
        name="Range"
        component={RangeNavigator}
        options={{
          tabBarLabel: 'Range',
        }}
      />
      <Tab.Screen
        name="Calculator"
        component={CalculatorNavigator}
        options={{
          tabBarLabel: 'Calc',
        }}
      />
      <Tab.Screen
        name="Logs"
        component={LogsNavigator}
        options={{
          tabBarLabel: 'Logs',
        }}
      />
    </Tab.Navigator>
  );
};
