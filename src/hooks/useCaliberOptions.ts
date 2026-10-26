import { useMemo } from 'react';

import { caliberOptionsWith } from '../constants/calibers';
import { useAppStore } from '../store/useAppStore';

/**
 * The options for a caliber picker: the built-in list, then the shooter's own
 * calibers (#67). Every caliber picker reads this rather than the constant, so
 * a custom caliber is offered everywhere a built-in one is.
 */
export const useCaliberOptions = (): { label: string; value: string }[] => {
  const custom = useAppStore((state) => state.settings.customCalibers);
  return useMemo(() => caliberOptionsWith(custom), [custom]);
};
