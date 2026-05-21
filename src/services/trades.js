import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';

/** Look up a user document by email. Returns { uid, data } or null. */
export async function findUserByEmail(email) {
  const q    = query(collection(db, 'users'), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { uid: snap.docs[0].id, data: snap.docs[0].data() };
}

/** Send a trade proposal to another user. */
export async function sendProposal({ fromEmail, fromUid, toEmail, toUid, giveCode, giveName, giveTeam, wantCode, wantName, wantTeam }) {
  await addDoc(collection(db, 'proposals'), {
    fromEmail, fromUid,
    toEmail,   toUid,
    giveCode,  giveName,  giveTeam,
    wantCode,  wantName,  wantTeam,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

/** Fetch all pending proposals addressed to an email. */
export async function loadIncomingProposals(toEmail) {
  const q    = query(collection(db, 'proposals'), where('toEmail', '==', toEmail), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Accept or reject a proposal by ID. */
export async function respondToProposal(propId, action) {
  await updateDoc(doc(db, 'proposals', propId), {
    status: action === 'accept' ? 'accepted' : 'rejected',
  });
}

/** Upsert the current user's entry on the public trade board. */
export async function publishToBoard(email, dups, missing) {
  const q    = query(collection(db, 'tradeBoard'), where('email', '==', email));
  const snap = await getDocs(q);
  const entry = { email, dups, missing, updatedAt: serverTimestamp() };
  if (!snap.empty) {
    await updateDoc(doc(db, 'tradeBoard', snap.docs[0].id), entry);
  } else {
    await addDoc(collection(db, 'tradeBoard'), entry);
  }
}

/** Fetch all entries from the public trade board. */
export async function fetchPublicBoard() {
  const snap = await getDocs(collection(db, 'tradeBoard'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
