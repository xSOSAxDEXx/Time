/**
 * Which build of Punch'd this is (owner request, 4 Nov 2026), so the owner
 * can tell which revision a phone or browser is running. The GitHub
 * workflows set these when they build; a build made anywhere else shows
 * "dev". Each `process.env.EXPO_PUBLIC_…` must be written out in full so
 * Expo can fill it in at build time.
 *
 * - Revision: the number of commits on main, so it goes up with every
 *   change and is the same for the Android app and the web app built from
 *   the same code.
 * - Build: the Android test build number (its GitHub release), if any.
 */
export type RevisionInfo = { revision: string; commit: string; build: string; built: string };

export const REVISION_INFO: RevisionInfo = {
  revision: process.env.EXPO_PUBLIC_REVISION ?? '',
  commit: process.env.EXPO_PUBLIC_COMMIT ?? '',
  build: process.env.EXPO_PUBLIC_BUILD ?? '',
  built: process.env.EXPO_PUBLIC_BUILT ?? '',
};

/** "Revision 22", or "Revision dev" for a build not made by GitHub. */
export function revisionLabel(info: RevisionInfo = REVISION_INFO): string {
  return `Revision ${info.revision || 'dev'}`;
}

/** "Revision 22 · Android test build 10 · built 2026-11-04 · a1b2c3d". */
export function revisionDetails(info: RevisionInfo = REVISION_INFO): string {
  return [
    revisionLabel(info),
    info.build && `Android test build ${info.build}`,
    info.built && `built ${info.built}`,
    info.commit,
  ]
    .filter(Boolean)
    .join(' · ');
}
