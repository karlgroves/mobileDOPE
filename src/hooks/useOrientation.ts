/**
 * useOrientation Hook
 * Detects device orientation and provides responsive layout utilities
 */

import { useWindowDimensions } from 'react-native';

export interface OrientationInfo {
  /** Current screen width */
  width: number;
  /** Current screen height */
  height: number;
  /** True if device is in landscape mode */
  isLandscape: boolean;
  /** True if device is in portrait mode */
  isPortrait: boolean;
  /** True if screen width is considered large (>= 768px, typically tablets in landscape) */
  isLargeScreen: boolean;
  /** True if screen width is considered medium (>= 600px, tablets in portrait or phones in landscape) */
  isMediumScreen: boolean;
  /** True if screen width is small (< 600px, phones in portrait) */
  isSmallScreen: boolean;
}

/**
 * Hook to detect device orientation and screen size
 * Automatically updates when device orientation changes
 *
 * @example
 * const { isLandscape, isLargeScreen } = useOrientation();
 *
 * return (
 *   <View style={[styles.container, isLandscape && styles.landscapeContainer]}>
 *     {isLargeScreen ? <LargeLayout /> : <CompactLayout />}
 *   </View>
 * );
 */
export function useOrientation(): OrientationInfo {
  const { width, height } = useWindowDimensions();

  // Breakpoints
  const SMALL_BREAKPOINT = 600; // Phone portrait
  const MEDIUM_BREAKPOINT = 768; // Tablet portrait or phone landscape

  const isLandscape = width > height;
  const isPortrait = width <= height;
  const isSmallScreen = width < SMALL_BREAKPOINT;
  const isMediumScreen = width >= SMALL_BREAKPOINT && width < MEDIUM_BREAKPOINT;
  const isLargeScreen = width >= MEDIUM_BREAKPOINT;

  return {
    width,
    height,
    isLandscape,
    isPortrait,
    isLargeScreen,
    isMediumScreen,
    isSmallScreen,
  };
}
