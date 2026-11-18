// "Continuar con Google": native Google account sheet → ID token → Supabase session.
// Android only for now: iOS needs its own OAuth client + config plugin, added with Sign in with
// Apple once the Apple Developer membership is paid (Apple requires both together).
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { GOOGLE_WEB_CLIENT_ID } from '@/config';
import { supabase } from '@/lib/supabase';

export const googleAvailable = Platform.OS === 'android';

if (googleAvailable) GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

/** Signs in with Google. Resolves false when the user closes the account sheet. */
export async function signInWithGoogle(captchaToken?: string) {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res) || !res.data.idToken) return false;
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: res.data.idToken,
      options: { captchaToken },
    });
    if (error) throw error;
    return true;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return false;
    throw e;
  }
}

/** Forget the Google account choice so the next sign-in shows the account picker again. */
export const signOutOfGoogle = () =>
  googleAvailable ? GoogleSignin.signOut().catch(() => null) : Promise.resolve(null);
