import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import {
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from './config';

/**
 * Uses native Google account selection on Android, while keeping popup sign-in on web.
 * The plugin skips native Firebase auth so the existing JavaScript Firebase session,
 * Firestore user profile, and coin system continue to use the same auth instance.
 */
export async function loginWithGoogle(): Promise<User> {
  try {
    if (Capacitor.isNativePlatform()) {
      const result = await FirebaseAuthentication.signInWithGoogle({
        skipNativeAuth: true,
      });
      const idToken = result.credential?.idToken;
      const accessToken = result.credential?.accessToken;

      if (!idToken && !accessToken) {
        throw new Error('Google girişinden kimlik bilgisi alınamadı. Firebase Android yapılandırmasını kontrol edin.');
      }

      const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken);
      const webResult = await signInWithCredential(auth, credential);
      return webResult.user;
    }

    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      throw new Error('Giriş penceresi kullanıcı tarafından kapatıldı.');
    } else if (error?.code === 'auth/cancelled-popup-request') {
      throw new Error('Giriş isteği iptal edildi.');
    } else if (error?.code === 'auth/popup-blocked') {
      throw new Error('Tarayıcınız açılır pencereyi engelledi. Lütfen açılır pencerelere izin verip tekrar deneyin.');
    } else if (error?.code === 'auth/network-request-failed') {
      throw new Error('Bağlantı hatası: İnternet bağlantınızı kontrol edin.');
    } else if (error?.code === 'auth/unauthorized-domain') {
      throw new Error('Bu etki alanı Firebase Authentication izinli alanlarında tanımlı değil.');
    } else if (error?.message?.includes('canceled') || error?.message?.includes('cancelled')) {
      throw new Error('Google ile giriş iptal edildi.');
    }
    throw new Error(error?.message || 'Google ile giriş başarısız oldu.');
  }
}

/** Signs out the JavaScript Firebase user and native plugin session when applicable. */
export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch {
      // The JS Firebase session is already signed out; native cleanup is best effort.
    }
  }
}

/** Subscribes to Firebase Authentication state transitions. */
export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
