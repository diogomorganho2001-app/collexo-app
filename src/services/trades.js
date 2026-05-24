import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
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
export async function sendProposal({ fromEmail, fromUid, fromUserId, toEmail, toUid, toUserId, giveCode, giveName, giveTeam, wantCode, wantName, wantTeam, message, requestType, attachedWantList }) {
  await addDoc(collection(db, 'proposals'), {
    fromEmail,
    fromUid,
    fromUserId,
    toEmail,
    toUid,
    toUserId,
    giveCode: giveCode || '',
    giveName: giveName || '',
    giveTeam: giveTeam || '',
    wantCode,
    wantName,
    wantTeam,
    message: message || '',
    requestType: requestType || 'proposal',
    attachedWantList: attachedWantList || [],
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

/** Fetch all pending proposals addressed to the current user ID.
 *  Queries both toUserId and toUid to handle proposals created by
 *  either field, then deduplicates by document ID.
 */
export async function loadIncomingProposals(toUserId) {
  const q1 = query(collection(db, 'proposals'), where('toUserId', '==', toUserId), where('status', '==', 'pending'));
  const q2 = query(collection(db, 'proposals'), where('toUid',    '==', toUserId), where('status', '==', 'pending'));

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const seen = new Set();
  const results = [];
  for (const d of [...snap1.docs, ...snap2.docs]) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      results.push({ id: d.id, ...d.data() });
    }
  }
  return results;
}

/** Accept or reject a proposal by ID. */
export async function respondToProposal(propId, action) {
  await updateDoc(doc(db, 'proposals', propId), {
    status: action === 'accept' ? 'accepted' : 'rejected',
  });
}

/** Create or return an existing chat room for an accepted proposal. */
export async function createChatRoomForProposal(proposal) {
  if (!proposal || !proposal.id) return null;
  const chatQuery = query(collection(db, 'chats'), where('tradeId', '==', proposal.id));
  const chatSnap = await getDocs(chatQuery);
  if (!chatSnap.empty) {
    return { id: chatSnap.docs[0].id, ...chatSnap.docs[0].data() };
  }

  const room = {
    tradeId: proposal.id,
    tradeType: proposal.requestType || 'proposal',
    participantIds: [proposal.fromUid, proposal.toUid].filter(Boolean),
    participantEmails: [proposal.fromEmail, proposal.toEmail],
    fromUid: proposal.fromUid,
    toUid: proposal.toUid,
    lastMessage: '',
    lastUpdated: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  // Retry creating the chat room a few times in case of transient errors
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const roomRef = await addDoc(collection(db, 'chats'), room);
      return { id: roomRef.id, ...room };
    } catch (err) {
      // If last attempt, rethrow so caller can handle/log
      if (attempt === maxAttempts) throw err;
      // small exponential backoff
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }
  return null;
}

export async function loadChatRooms(userId) {
  const q = query(
    collection(db, 'chats'),
    where('participantIds', 'array-contains', userId),
    orderBy('lastUpdated', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function loadChatMessages(chatId) {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function sendChatMessage(chatId, senderId, senderEmail, text) {
  if (!text || !text.trim()) return;
  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    senderId,
    senderEmail,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: text.trim(),
    lastUpdated: serverTimestamp(),
  });
}

/** Upsert the current user's entry on the public trade board. */
export async function publishToBoard(email, ownerId, dups, missing) {
  const q    = query(collection(db, 'tradeBoard'), where('email', '==', email));
  const snap = await getDocs(q);
  const entry = { email, ownerId, dups, missing, updatedAt: serverTimestamp() };
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

/** Search for users by email prefix (for user search feature). */
export async function searchUsersByEmail(searchQuery) {
  if (!searchQuery || searchQuery.length < 2) return [];
  try {
    const q = query(
      collection(db, 'users'),
      where('email', '>=', searchQuery),
      where('email', '<=', searchQuery + '\uf8ff')
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email,
      completionPct: doc.data().completionPct || 0
    }));
  } catch (err) {
    console.error('Error searching users:', err);
    return [];
  }
}

/** Get a specific user's sticker collection by email. */
export async function getUserCollection(email) {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const userData = snap.docs[0].data();
    return {
      email: userData.email,
      stickers: userData.stickers || [],
      completionPct: userData.completionPct || 0
    };
  } catch (err) {
    console.error('Error fetching user collection:', err);
    return null;
  }
}

/** Load all trade history (both sent and received proposals). */
export async function loadAllTradeHistory(userId) {
  try {
    // Get sent proposals that were accepted or rejected
    const sentQ = query(
      collection(db, 'proposals'),
      where('fromUserId', '==', userId),
      where('status', 'in', ['accepted', 'rejected'])
    );
    
    // Get received proposals that were accepted or rejected
    const receivedQ = query(
      collection(db, 'proposals'),
      where('toUserId', '==', userId),
      where('status', 'in', ['accepted', 'rejected'])
    );
    
    const [sentSnap, receivedSnap] = await Promise.all([
      getDocs(sentQ),
      getDocs(receivedQ)
    ]);
    
    const trades = [
      ...sentSnap.docs.map(d => ({
        ...d.data(),
        direction: 'sent',
        timestamp: d.data().createdAt?.toMillis?.() || 0
      })),
      ...receivedSnap.docs.map(d => ({
        ...d.data(),
        direction: 'received',
        timestamp: d.data().createdAt?.toMillis?.() || 0
      }))
    ];
    
    // Sort by timestamp descending (newest first)
    return trades.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error('Error loading trade history:', err);
    return [];
  }
}

/** Get a single proposal by id */
export async function getProposalById(proposalId) {
  const d = await getDoc(doc(db, 'proposals', proposalId));
  if (!d.exists()) return null;
  return { id: d.id, ...d.data() };
}