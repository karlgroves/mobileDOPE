/**
 * Android export folder (#215).
 *
 * On Android the user can pick a folder, through the Storage Access Framework,
 * where every manual export also saves a copy. The share sheet still opens as
 * before, so the folder is an addition, not a replacement.
 *
 * Scope, by the owner's decision of 2026-11-07: manual exports only. Automatic
 * backups stay in the app's private `backups/` folder and Share Latest Backup
 * is unchanged, as PRIVACY.md promises. iOS has no persistent folder access
 * (its picker grants the current session only), so there the setting is
 * hidden, no folder is ever stored, and nothing here does anything. The
 * platform check lives in the component: this module stays free of
 * `react-native` so the node-based `unit` Jest project can load ExportService.
 *
 * The picker takes a persistable grant on the folder (expo-file-system's
 * `Directory.pickDirectoryAsync`), so the choice survives a restart. If the
 * folder is later deleted or the grant revoked, the copy is skipped: the export
 * itself is still written to the app's documents directory and shared, which is
 * the fallback the issue asks for. Settings reports the folder as unavailable.
 *
 * No storage permission is involved: SAF access is granted per folder by the
 * system picker.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const EXPORT_FOLDER_STORAGE_KEY = '@mobileDOPE:exportFolderUri';

/** What the share sheet is told about an exported file. */
export interface ExportShareOptions {
  mimeType: string;
  dialogTitle: string;
  UTI: string;
}

/**
 * The chosen folder's content uri, or undefined if none is set. Only the
 * Android Settings control sets one (`ExportFolderSetting`), so on iOS this is
 * always undefined.
 */
export async function getExportFolderUri(): Promise<string | undefined> {
  try {
    return (await AsyncStorage.getItem(EXPORT_FOLDER_STORAGE_KEY)) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Open the system folder picker and remember the folder chosen. Resolves to
 * its uri, or undefined if the user cancelled.
 */
export async function chooseExportFolder(): Promise<string | undefined> {
  let directory: Directory;
  try {
    directory = await Directory.pickDirectoryAsync();
  } catch {
    // The picker rejects when it is dismissed without a choice.
    return undefined;
  }
  await AsyncStorage.setItem(EXPORT_FOLDER_STORAGE_KEY, directory.uri);
  return directory.uri;
}

/** Forget the chosen folder. Files already saved there are not touched. */
export async function clearExportFolder(): Promise<void> {
  await AsyncStorage.removeItem(EXPORT_FOLDER_STORAGE_KEY);
}

/**
 * A readable name for a SAF tree uri: `.../tree/primary%3ADownload%2FDOPE`
 * becomes `Download/DOPE`. Falls back to the decoded last segment.
 */
export function exportFolderLabel(uri: string): string {
  let segment = uri.slice(uri.lastIndexOf('/') + 1);
  try {
    segment = decodeURIComponent(segment);
  } catch {
    // A malformed escape: show the segment as it is.
  }
  const volumePath = segment.slice(segment.indexOf(':') + 1);
  return volumePath || segment;
}

/** Whether the folder at `uri` can still be reached (not deleted, grant not revoked). */
export function isExportFolderAvailable(uri: string): boolean {
  try {
    return new Directory(uri).exists;
  } catch {
    return false;
  }
}

/**
 * Result of {@link saveCopyToExportFolder}: `none` when no folder is chosen, `unavailable` when one is chosen but could not be written to.
 */
export type ExportFolderCopy = 'saved' | 'none' | 'unavailable';

/** The last path segment of a file uri. */
const fileNameOf = (uri: string): string => uri.slice(uri.lastIndexOf('/') + 1);

/**
 * Save a copy of the file at `sourceUri` to the chosen folder, as `name`
 * (default: the source's own file name). Never throws: a folder that cannot be
 * written to is reported, and the caller carries on with the copy in app
 * storage.
 */
export async function saveCopyToExportFolder(
  sourceUri: string,
  mimeType: string,
  name: string = fileNameOf(sourceUri)
): Promise<ExportFolderCopy> {
  const folderUri = await getExportFolderUri();
  if (!folderUri) return 'none';
  try {
    const folder = new Directory(folderUri);
    if (!folder.exists) return 'unavailable';
    const bytes = await new File(sourceUri).bytes();
    folder.createFile(name, mimeType).write(bytes);
    return 'saved';
  } catch (error) {
    console.warn('Could not save export to the chosen folder:', error);
    return 'unavailable';
  }
}

/**
 * Finish a manual export: save a copy to the chosen folder (Android, if one is
 * set), then hand the file to the share sheet where one is available.
 *
 * `name` is the file name for the folder copy. Pass one for expo-print output,
 * whose own name is random.
 */
export async function deliverExport(
  uri: string,
  share: ExportShareOptions,
  name?: string
): Promise<ExportFolderCopy> {
  const copy = await saveCopyToExportFolder(uri, share.mimeType, name);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, share);
  }
  return copy;
}
