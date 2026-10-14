import {
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Load a user's saved data from Firestore.
 * Returns { stickers, tradeHistory, milestonesSeen, lists } or null if no doc.
 */
export async function loadUserData(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    ...data,
    stickers: Array.isArray(data.stickers) ? data.stickers : [],
    tradeHistory: Array.isArray(data.tradeHistory) ? data.tradeHistory : [],
    milestonesSeen: data.milestonesSeen || {},
    lists: Array.isArray(data.lists) ? data.lists : [],
    portfolioHistory: Array.isArray(data.portfolioHistory) ? data.portfolioHistory : [],
  };
}

/**
 * Persist a user's full state to Firestore.
 */
export async function saveUserData(uid, email, stickers, tradeHistory, milestonesSeen, lists = [], portfolioHistory = []) {
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
    lists: Array.isArray(lists) ? lists : [],
    portfolioHistory: Array.isArray(portfolioHistory) ? portfolioHistory : [],
    updatedAt: new Date(),
  }, { merge: true });
}
