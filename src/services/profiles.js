import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

export const PUBLIC_PROFILE_FIELDS = [
  'uid',
  'displayName',
  'avatarUrl',
  'bio',
  'isPublic',
  'completionPct',
  'createdAt',
  'updatedAt',
];

export function normalizeDisplayName(value = '') {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48);

  return cleaned || 'Collector';
}

export function normalizeAvatarUrl(value = '') {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

export function sanitizePublicProfileInput(input = {}, uidOverride = '') {
  const uid = String(uidOverride || input.uid || '').trim();
  const displayName = normalizeDisplayName(input.displayName || input.name);
  const avatarUrl = normalizeAvatarUrl(input.avatarUrl);
  const bio = typeof input.bio === 'string' ? input.bio.trim().slice(0, 180) : '';

  return {
    uid,
    displayName,
    avatarUrl,
    bio,
    isPublic: true,
    completionPct: Number(input.completionPct ?? 0) || 0,
  };
}

export function createPublicProfilePatch(updates = {}) {
  const allowed = {};
  const keys = Object.keys(updates || {});

  if (keys.includes('uid')) {
    throw new Error('A public profile UID cannot be changed.');
  }
  if (keys.some(key => key === 'email' || key === 'privateCollection' || key === 'stickers' || key === 'tradeHistory')) {
    throw new Error('Private user data must not be stored in a public profile.');
  }

  if ('displayName' in updates) {
    allowed.displayName = normalizeDisplayName(updates.displayName);
  }
  if ('avatarUrl' in updates) {
    allowed.avatarUrl = normalizeAvatarUrl(updates.avatarUrl);
  }
  if ('bio' in updates) {
    allowed.bio = typeof updates.bio === 'string' ? updates.bio.trim().slice(0, 180) : '';
  }
  if ('isPublic' in updates) {
    allowed.isPublic = Boolean(updates.isPublic);
  }
  if ('completionPct' in updates) {
    allowed.completionPct = Number(updates.completionPct || 0) || 0;
  }

  if (Object.keys(allowed).length === 0) {
    return null;
  }

  return {
    ...allowed,
    updatedAt: serverTimestamp(),
  };
}

export async function ensurePublicProfile(uid, profile = {}) {
  if (!uid) {
    throw new Error('A Firebase uid is required to create a public profile.');
  }

  const ref = doc(db, 'publicProfiles', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { uid: snap.id, ...snap.data() };
  }

  const next = sanitizePublicProfileInput(profile, uid);
  await setDoc(ref, {
    ...next,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { uid, ...next };
}

export async function getPublicProfileByUid(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'publicProfiles', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

export async function updatePublicProfile(uid, updates = {}) {
  if (!uid) {
    throw new Error('A Firebase uid is required to update a public profile.');
  }

  const patch = createPublicProfilePatch(updates);
  if (!patch) {
    return await getPublicProfileByUid(uid);
  }

  await updateDoc(doc(db, 'publicProfiles', uid), patch);
  return await getPublicProfileByUid(uid);
}

export async function searchPublicProfiles(searchQuery = '') {
  const queryText = String(searchQuery || '').trim();
  if (!queryText || queryText.length < 2) return [];

  const q = query(
    collection(db, 'publicProfiles'),
    where('isPublic', '==', true),
    where('displayName', '>=', queryText),
    where('displayName', '<=', queryText + '\uf8ff'),
  );

  const snap = await getDocs(q);
  return snap.docs.map(docSnap => ({ uid: docSnap.id, ...docSnap.data() }));
}
