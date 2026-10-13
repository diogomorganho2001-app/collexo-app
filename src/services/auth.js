import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { ensurePublicProfile } from './profiles.js';

function requireAuth() {
  if (!auth) {
    throw new Error('Firebase authentication is not configured for this environment.');
  }
  return auth;
}

export function login(email, password) {
  return signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function register(email, password, displayName = '') {
  const authInstance = requireAuth();
  const credential = await createUserWithEmailAndPassword(authInstance, email, password);
  const safeName = displayName && String(displayName).trim()
    ? String(displayName).trim()
    : (email || '').split('@')[0] || 'Collector';

  await ensurePublicProfile(credential.user.uid, {
    uid: credential.user.uid,
    displayName: safeName,
    avatarUrl: '',
    bio: '',
    isPublic: true,
    completionPct: 0,
  });

  return credential;
}

export function resetPassword(email) {
  return sendPasswordResetEmail(requireAuth(), email);
}

export function logout() {
  return signOut(requireAuth());
}

export function onAuthChange(callback) {
  return onAuthStateChanged(requireAuth(), callback);
}
