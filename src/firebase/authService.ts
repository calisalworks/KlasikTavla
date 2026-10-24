import {
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from './config';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

/**
 * Initiates Google Sign-In.
 * In Web browsers: uses standard Firebase JS SDK signInWithPopup.
 * In native Android APK: uses @capacitor-firebase/authentication for native Play Services Google Sign-In
 * and bridges the resulting ID token into the Firebase JS SDK via signInWithCredential.
 */
export async function loginWithGoogle(): Promise<User> {
  if (Capacitor.isNativePlatform()) {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;

      if (!idToken) {
        // Fallback: check if the plugin has an active token
        const currentToken = await FirebaseAuthentication.getIdToken().catch(() => null);
        if (currentToken?.token) {
          const credential = GoogleAuthProvider.credential(currentToken.token);
          const userCredential = await signInWithCredential(auth, credential);
          return userCredential.user;
        }
        throw new Error('Google kimlik doğrulama belirteci alınamadı.');
      }

      const credential = GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    } catch (nativeErr: any) {
      console.warn('Native Android Google Sign-in error:', nativeErr);
      const msg = String(nativeErr?.message || nativeErr || '');

      if (
        msg.includes('10:') ||
        msg.includes('DEVELOPER_ERROR') ||
        msg.includes('google-services')
      ) {
        throw new Error(
          'Google Giriş Yapılandırması Eksik: Firebase Console üzerinde uygulamanın SHA-1 parmak izi ve google-services.json dosyası tanımlanmalıdır.'
        );
      }
      if (
        msg.includes('12501') ||
        msg.includes('canceled') ||
        msg.includes('cancelled')
      ) {
        throw new Error('Google girişi kullanıcı tarafından iptal edildi.');
      }
      if (msg.includes('network') || msg.includes('7:')) {
        throw new Error('Bağlantı hatası: İnternet bağlantınızı kontrol edip tekrar deneyin.');
      }
      throw new Error(nativeErr?.message || 'Android ortamında Google ile giriş yapılamadı.');
    }
  }

  try {
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
    }
    throw new Error(error?.message || 'Google ile giriş başarısız oldu.');
  }
}

/**
 * Signs out current user from both native layer and Firebase JS SDK
 */
export async function logoutUser(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (err) {
      console.warn('Native FirebaseAuthentication.signOut warning:', err);
    }
  }
  await firebaseSignOut(auth);
}

/**
 * Subscribes to Firebase Authentication state transitions
 */
export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
