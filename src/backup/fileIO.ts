import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SaveResult = 'shared' | 'unavailable';

const UTI: Record<string, string> = {
  'application/json': 'public.json',
  'text/csv': 'public.comma-separated-values-text',
};

/**
 * Saving a file on the phone: it's written to the app's cache and the share
 * sheet opens, so the person puts it in Files, Drive, email or wherever they
 * like. Nothing is sent anywhere automatically.
 */
export async function saveFile(
  fileName: string,
  text: string,
  mimeType: string,
  dialogTitle: string,
): Promise<SaveResult> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, { mimeType, UTI: UTI[mimeType], dialogTitle });
  return 'shared';
}

/** Lets the person choose a backup file. Returns its text, or null if they cancelled. */
export async function pickBackupText(): Promise<string | null> {
  // Any type: cloud drives often label .json files as plain binary.
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', '*/*'] });
  if (!picked || picked.canceled) return null;
  return picked.result.text();
}
