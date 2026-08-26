/**
 * Navigation type definitions
 * Define all navigation routes and their parameters
 */

import type { BallisticSolution } from '../types/ballistic.types';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/**
 * Root Stack Navigator
 */
export type RootStackParamList = {
  MainTabs: undefined;
  Settings: undefined;
  PrivacyPolicy: undefined;
};

/**
 * Main Tab Navigator
 */
export type MainTabParamList = {
  Dashboard: undefined;
  Session: undefined;
  Calculator: undefined;
  Rifles: undefined;
  Ammo: undefined;
  History: undefined;
};

/**
 * Rifles Stack Navigator (formerly Profiles)
 */
export type RiflesStackParamList = {
  RifleProfileList: undefined;
  RifleProfileForm: { rifleId?: number };
  RifleProfileDetail: { rifleId: number };
  AmmoProfileList: { rifleId: number };
  AmmoProfileDetail: { ammoId?: number; rifleId?: number };
  AmmoProfileForm: { ammoId?: number; caliber?: string };
  DOPECardGenerator: { rifleId: number; ammoId: number };
  ChronographInput: { ammoId: number };
  ShotStringHistory: { ammoId: number };
};

/**
 * Ammo Stack Navigator
 */
export type AmmoStackParamList = {
  AllAmmoProfileList: undefined;
  AmmoProfileDetail: { ammoId?: number; rifleId?: number };
  AmmoProfileForm: { ammoId?: number; caliber?: string };
  DOPECardGenerator: { rifleId?: number; ammoId: number };
  ChronographInput: { ammoId: number };
  ShotStringHistory: { ammoId: number };
  AmmoCompare: { rifleId?: number };
};

/**
 * Session Stack Navigator (formerly Range)
 */
export type SessionStackParamList = {
  RangeSessionStart: undefined;
  RangeSessionActive: { sessionId: number };
  RangeSessionSummary: { sessionId: number };
  EnvironmentInput: undefined;
};

/**
 * History Stack Navigator (formerly Logs)
 */
export type HistoryStackParamList = {
  DOPELogList: undefined;
  DOPELogDetail: { logId: number };
  DOPELogEdit: { logId?: number };
  DOPECurve: { rifleId: number; ammoId: number };
};

/**
 * Calculator Stack Navigator
 */
export type CalculatorStackParamList = {
  BallisticCalculator: undefined;
  BallisticSolutionResults: {
    solution: BallisticSolution;
    rifleId: number;
    ammoId: number;
    distance: number;
    angularUnit: 'MIL' | 'MOA';
  };
  WindTable: { rifleId: number; ammoId: number; distance: number };
  MovingTargetCalculator: { rifleId?: number; ammoId?: number };
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

// Rifles Stack (formerly Profiles)
export type RiflesStackScreenProps<T extends keyof RiflesStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<RiflesStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

// Ammo Stack
export type AmmoStackScreenProps<T extends keyof AmmoStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<AmmoStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

// Session Stack (formerly Range)
export type SessionStackScreenProps<T extends keyof SessionStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<SessionStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

// Calculator Stack
export type CalculatorStackScreenProps<T extends keyof CalculatorStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<CalculatorStackParamList, T>,
    MainTabScreenProps<keyof MainTabParamList>
  >;

// History Stack (formerly Logs)
export type HistoryStackScreenProps<T extends keyof HistoryStackParamList> = CompositeScreenProps<
  NativeStackScreenProps<HistoryStackParamList, T>,
  MainTabScreenProps<keyof MainTabParamList>
>;

// Legacy type aliases from the Profiles->Rifles / Range->Session / Logs->History rename.
//
// These are NOT all dead. The three aliases below are still consumed by live, mounted
// screens, so removing them would break the build:
//
//   ProfilesStackParamList   -> AmmoProfileList, AmmoProfileDetail, AmmoProfileForm,
//                               RifleProfileDetail
//   ProfilesStackScreenProps -> DOPECardGenerator
//   LogsStackScreenProps     -> DOPELogList, DOPELogDetail, DOPELogEntry
//
// The other three (RangeStackParamList, RangeStackScreenProps, LogsStackParamList) were
// referenced only by the orphaned LogsNavigator/RangeNavigator/ProfilesNavigator and
// RangeScreen/LogsScreen, and were removed along with them.
//
// Migrating the screens above onto the current names (RiflesStack*/HistoryStack*) so these
// aliases can go too is deliberately left as follow-up work — it touches eight live screens
// and is unrelated to deleting dead files.
export type ProfilesStackParamList = RiflesStackParamList;
export type ProfilesStackScreenProps<T extends keyof ProfilesStackParamList> =
  RiflesStackScreenProps<T>;
export type LogsStackScreenProps<T extends keyof HistoryStackParamList> =
  HistoryStackScreenProps<T>;

// Declare global navigation types for type-safe navigation
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
