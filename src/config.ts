// Public identifiers that ship inside the app anyway (safe in this public repo).
// Never put a secret here: secrets live in supabase/.env, EAS secrets or the password manager.

/** Google Cloud "Binku Web" OAuth client: Android/iOS ask Google for an ID token for it. */
export const GOOGLE_WEB_CLIENT_ID =
  '34139401992-ggl41t9db7n0jfteqte9rifbasgsfu44.apps.googleusercontent.com';

/** Cloudflare Turnstile widget (hostname binku.app) checked before sign-in requests. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAGHjPKdrnTz9Zdfs';
