/**
 * Registers sw.js so the web app installs as a PWA and works offline.
 * Skipped in development so the dev server's live reload isn't cached.
 * Works under a sub-path (EXPO_BASE_URL, e.g. "/Time" on GitHub Pages).
 */
export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  navigator.serviceWorker
    .register(`${base}/sw.js`, { scope: `${base}/` })
    .catch((error: unknown) => {
      console.warn('Service worker registration failed', error);
    });
}
