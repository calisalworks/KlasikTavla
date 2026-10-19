import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, googleProvider } from './config';

/**
 * Initiates Google Sign-In with popup
 */
export async function loginWithGoogle(): Promise<User> {
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
 * Signs out current Firebase user
 */
export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Subscribes to Firebase Authentication state transitions
 */
export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
