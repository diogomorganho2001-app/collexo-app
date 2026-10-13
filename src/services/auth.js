import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase.js';
import { ensurePublicProfile } from './profiles.js';

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function register(email, password, displayName = '') {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
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

export function logout() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
