import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TabNavigator } from '../../../src/navigation/TabNavigator';
import { DashboardScreen } from '../../../src/screens/DashboardScreen';
import { useAmmoStore } from '../../../src/store/useAmmoStore';
import { useEnvironmentStore } from '../../../src/store/useEnvironmentStore';
import { useRifleStore } from '../../../src/store/useRifleStore';
import { renderWithProviders } from '../../helpers/renderWithProviders';

/**
 * The last tab opens the range-session stack, but was labelled "Weather" with a
 * cloud icon (dadf991), and Home's "Env" indicator also opened Start Session
 * rather than the weather screen (#131).
 */

// Only the tab bar is under test; each tab's content is a stand-in, which keeps
// the screens' Skia and SQLite imports out of this suite. The icon sets are
// real: they load since expo-font is declared at the SDK's version (#137).
jest.mock('../../../src/navigation/HistoryNavigator', () => {
  const mockNothing = () => null;
  return { HistoryNavigator: mockNothing };
});
jest.mock('../../../src/navigation/CalculatorNavigator', () => {
  const mockNothing = () => null;
  return { CalculatorNavigator: mockNothing };
});
jest.mock('../../../src/navigation/RiflesNavigator', () => {
  const mockNothing = () => null;
  return { RiflesNavigator: mockNothing };
});
jest.mock('../../../src/navigation/AmmoNavigator', () => {
  const mockNothing = () => null;
  return { AmmoNavigator: mockNothing };
});
jest.mock('../../../src/navigation/SessionNavigator', () => {
  const mockNothing = () => null;
  return { SessionNavigator: mockNothing };
});
/** The tab bar reads safe-area insets; give it a phone-shaped frame. */
const tabs = () => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 402, height: 874 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    <NavigationContainer>
      <TabNavigator />
    </NavigationContainer>
  </SafeAreaProvider>
);

const quietStores = (): void => {
  useRifleStore.setState({ rifles: [], loadRifles: jest.fn().mockResolvedValue(undefined) });
  useAmmoStore.setState({
    ammoProfiles: [],
    loadAmmoProfiles: jest.fn().mockResolvedValue(undefined),
  });
  useEnvironmentStore.setState({
    snapshots: [],
    loadSnapshots: jest.fn().mockResolvedValue(undefined),
  });
};

describe('the range-session tab (#131)', () => {
  beforeEach(quietStores);

  it('is labelled Session, not Weather', () => {
    const { getByText, queryByText } = renderWithProviders(tabs());

    expect(getByText('Session')).toBeTruthy();
    expect(queryByText('Weather')).toBeNull();
  });

  it('does not use a weather icon', () => {
    const view = renderWithProviders(tabs());
    // Each set's wrapper and inner component both match the type; dedupe.
    const names = new Set(
      [Ionicons, MaterialCommunityIcons].flatMap((set) =>
        view
          .UNSAFE_queryAllByType(set as React.ComponentType<{ name: string }>)
          .map((icon) => String(icon.props.name))
      )
    );

    // One per tab, so this cannot pass by finding no icons at all.
    expect(names.size).toBe(6);
    expect(names).toContain('clipboard');
    expect([...names].filter((n) => /cloud|sunny|rainy|weather/.test(n))).toEqual([]);
  });
});

describe("Home's Env indicator (#131)", () => {
  beforeEach(quietStores);

  it('opens the weather screen, not Start Session', () => {
    const navigate = jest.fn();
    const { getByLabelText } = renderWithProviders(
      <DashboardScreen navigation={{ navigate } as never} route={{} as never} />
    );

    fireEvent.press(getByLabelText('Environment: no readings'));

    expect(navigate).toHaveBeenCalledWith('Session', {
      screen: 'EnvironmentInput',
      // Start Session stays underneath, so the tab still opens there and the
      // weather screen has a way back.
      initial: false,
    });
  });

  it('says where it goes', () => {
    const { getByLabelText } = renderWithProviders(
      <DashboardScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
    );

    expect(getByLabelText('Environment: no readings').props.accessibilityHint).toMatch(/weather/i);
  });
});
