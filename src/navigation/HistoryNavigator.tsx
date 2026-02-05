import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DOPELogList } from '../screens/DOPELogList';
import { DOPELogDetail } from '../screens/DOPELogDetail';
import { DOPELogEntry } from '../screens/DOPELogEntry';
import { DOPECurve } from '../screens/DOPECurve';
import type { HistoryStackParamList } from './types';

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export const HistoryNavigator: React.FC = () => {
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
