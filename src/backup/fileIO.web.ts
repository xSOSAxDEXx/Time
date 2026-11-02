import type { SaveResult } from './fileIO';

/**
 * Web version: saving downloads the file; choosing opens the browser's file
 * picker. Nothing leaves the device unless the person moves the file.
 */
export async function saveFile(
  fileName: string,
  text: string,
  mimeType: string,
): Promise<SaveResult> {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'shared';
}

export function pickBackupText(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, reject);
    };
    // Fires in browsers that support it, so a cancelled picker doesn't hang.
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
