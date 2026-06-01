declare global {
  // eslint-disable-next-line no-var
  var __otpStore: Map<string, { code: string; expiresAt: number }> | undefined;
}

// global persiste a través de hot-reloads en desarrollo
const store: Map<string, { code: string; expiresAt: number }> =
  globalThis.__otpStore ?? (globalThis.__otpStore = new Map());

export function saveOTP(email: string, code: string) {
  store.set(email.toLowerCase(), {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
}

export function checkOTP(email: string, code: string): boolean {
  const entry = store.get(email.toLowerCase());
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    store.delete(email.toLowerCase());
    return false;
  }
  if (entry.code !== code) return false;
  store.delete(email.toLowerCase());
  return true;
}
