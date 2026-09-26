/*
 * Signing in. The real admin asks for a password and keeps a session in D1;
 * the demo opens straight into the dashboard, so every check passes.
 */

export function isSignedIn(): boolean {
  return true;
}

export function requireAdmin(): void {}

export function signOut(): void {}
