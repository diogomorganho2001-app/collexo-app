import {
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Load a user's saved data from Firestore.
 * Returns { stickers, tradeHistory, milestonesSeen } or null if no doc.
 */
export async function loadUserData(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  return null;
}

/**
 * Persist a user's full state to Firestore.
 */
export async function saveUserData(uid, email, stickers, tradeHistory, milestonesSeen) {
  const owned = stickers.filter(s => s.owned).length;
  const completionPct = stickers.length
    ? Math.floor((owned / stickers.length) * 100)
    : 0;

  await setDoc(doc(db, 'users', uid), {
    stickers,
    email,
    tradeHistory,
    milestonesSeen,
    completionPct,
  });
}
