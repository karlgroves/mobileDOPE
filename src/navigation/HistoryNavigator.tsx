import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTheme } from '../contexts/ThemeContext';
import { DOPECurve } from '../screens/DOPECurve';
import { DOPELogDetail } from '../screens/DOPELogDetail';
import { DOPELogEntry } from '../screens/DOPELogEntry';
import { DOPELogList } from '../screens/DOPELogList';

import { stackHeaderOptions } from './navigationTheme';

import type { HistoryStackParamList } from './types';

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export const HistoryNavigator: React.FC = () => {
  const { colors } = useTheme().theme;

  return (
    <Stack.Navigator
      screenOptions={{
        ...stackHeaderOptions(colors),
      }}
    >
      <Stack.Screen name="DOPELogList" component={DOPELogList} options={{ title: 'DOPE Logs' }} />
      <Stack.Screen
        name="DOPELogDetail"
        component={DOPELogDetail}
        options={{ title: 'DOPE Log Details' }}
      />
      <Stack.Screen
        name="DOPELogEdit"
        component={DOPELogEntry}
        options={({ route }) => ({
          title: route.params?.logId ? 'Edit DOPE Log' : 'New DOPE Log',
        })}
      />
      <Stack.Screen name="DOPECurve" component={DOPECurve} options={{ title: 'Ballistic Curve' }} />
    </Stack.Navigator>
  );
};
