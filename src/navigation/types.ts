/**
 * Navigation type definitions
 * Define all navigation routes and their parameters
 */

import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Root Stack Navigator
 */
export type RootStackParamList = {
  MainTabs: undefined;
};

/**
 * Main Tab Navigator
 */
export type MainTabParamList = {
  Dashboard: undefined;
  Profiles: undefined;
  Range: undefined;
  Calculator: undefined;
  Logs: undefined;
};

/**
 * Profiles Stack Navigator
 */
export type ProfilesStackParamList = {
  RifleProfileList: undefined;
  RifleProfileForm: { rifleId?: number };
  RifleProfileDetail: { rifleId: number };
  AmmoProfileList: { rifleId: number };
  AmmoProfileDetail: { ammoId?: number; rifleId: number };
  AmmoProfileForm: { ammoId?: number; rifleId: number };
};

/**
 * Range Stack Navigator
 */
export type RangeStackParamList = {
  RangeSessionStart: undefined;
  RangeSessionActive: { sessionId: number };
  RangeSessionSummary: { sessionId: number };
};

/**
 * Calculator Stack Navigator
 */
export type CalculatorStackParamList = {
  BallisticCalculator: undefined;
  WindTable: { rifleId: number; ammoId: number; distance: number };
};

/**
 * Logs Stack Navigator
 */
export type LogsStackParamList = {
  DOPELogList: undefined;
  DOPELogDetail: { logId: number };
  DOPELogEdit: { logId?: number };
  DOPECurve: { rifleId: number; ammoId: number };
};

/**
 * Screen props types for type-safe navigation
 */

// Root Stack
export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

// Main Tabs
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// Profiles Stack
export type ProfilesStackScreenProps<T extends keyof ProfilesStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ProfilesStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

// Range Stack
export type RangeStackScreenProps<T extends keyof RangeStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<RangeStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

// Calculator Stack
export type CalculatorStackScreenProps<T extends keyof CalculatorStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CalculatorStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

// Logs Stack
export type LogsStackScreenProps<T extends keyof LogsStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<LogsStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

// Declare global navigation types for type-safe navigation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
