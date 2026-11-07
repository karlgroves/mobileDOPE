import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { View } from 'react-native';

/**
 * Shares a marked target as a PNG (#63).
 *
 * `ref` goes on the view to capture -- `TargetView`'s `exportRef`, which holds
 * the target and its caption without the zoom controls. The image is the
 * target as it is shown, so the zoom on screen is the zoom in the picture.
 */
export const useShareTargetImage = () => {
  const ref = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }
      const uri = await captureRef(ref, { format: 'png', result: 'tmpfile' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Target Image',
        UTI: 'public.png',
      });
    } catch (error) {
      Alert.alert('Share Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSharing(false);
    }
  };

  return { ref, sharing, share };
};
