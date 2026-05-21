import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

export async function fetchLeaderboard(limitCount = 10) {
  const q    = query(collection(db, 'users'), orderBy('completionPct', 'desc'), limit(limitCount));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}
