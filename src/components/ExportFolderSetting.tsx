import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import {
  chooseExportFolder,
  clearExportFolder,
  exportFolderLabel,
  getExportFolderUri,
  isExportFolderAvailable,
} from '../services/exportFolder';

import { Button } from './Button';

/**
 * Settings › Data Management › Export Folder (#215). Android only.
 *
 * Lets the user pick a folder, through the system picker, where every manual
 * export also saves a copy. The share sheet still opens. Automatic backups are
 * not affected: they stay in the app's private storage. See
 * `src/services/exportFolder.ts`.
 *
 * Renders nothing on iOS, which has no lasting folder access to offer.
 */
export const ExportFolderSetting: React.FC = () => {
  const { theme } = useTheme();
  const { colors } = theme;
  const [folderUri, setFolderUri] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    void getExportFolderUri().then((uri) => {
      if (mounted) setFolderUri(uri);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (Platform.OS !== 'android') return null;

  const handleChoose = async () => {
    try {
      const uri = await chooseExportFolder();
      if (uri) setFolderUri(uri);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not save the folder');
    }
  };

  const handleClear = async () => {
    try {
      await clearExportFolder();
      setFolderUri(undefined);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not clear the folder');
    }
  };

  let status: string;
  if (!folderUri) {
    status = 'Exports open the share sheet. Choose a folder to also save a copy of each one there.';
  } else if (isExportFolderAvailable(folderUri)) {
    status = `Exports are also saved to ${exportFolderLabel(folderUri)}, then the share sheet opens.`;
  } else {
    status =
      `The folder ${exportFolderLabel(folderUri)} can no longer be reached. Exports open ` +
      'the share sheet only until you choose another folder.';
  }

  return (
    <>
      <Text style={[styles.status, { color: colors.text.secondary }]} testID="export-folder-status">
        {status} Automatic backups stay in the app&apos;s private storage.
      </Text>
      <Button
        title={folderUri ? 'Change Export Folder' : 'Choose Export Folder'}
        onPress={() => void handleChoose()}
        variant="secondary"
        size="medium"
        style={styles.button}
        accessibilityHint="Opens the system folder picker"
        testID="choose-export-folder"
      />
      {folderUri && (
        <Button
          title="Stop Saving to Folder"
          onPress={() => void handleClear()}
          variant="secondary"
          size="medium"
          style={styles.button}
          accessibilityHint="Exports go to the share sheet only. Files already saved are kept."
          testID="clear-export-folder"
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  status: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  button: {
    marginBottom: 12,
  },
});
