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

/** Accept or reject a proposal by ID.
 *  Must send exactly { status, updatedAt } to satisfy Firestore rules:
 *  keys().hasOnly(['status','updatedAt','responseMessage'])
 */
export async function respondToProposal(propId, action) {
  await updateDoc(doc(db, 'proposals', propId), {
    status: action === 'accept' ? 'accepted' : 'rejected',
    updatedAt: serverTimestamp(),
  });
}

/** Create or return an existing chat room for an accepted proposal. */
export async function createChatRoomForProposal(proposal) {
  if (!proposal || !proposal.id) throw new Error('No proposal ID provided');

  // Re-fetch the proposal so we always have the full, fresh document.
  const freshSnap = await getDoc(doc(db, 'proposals', proposal.id));
  if (!freshSnap.exists()) throw new Error('Proposal document not found in Firestore');
  const p = { id: freshSnap.id, ...freshSnap.data() };

  // Resolve IDs — proposals store both fromUid/fromUserId; accept either.
  const fromId = p.fromUid || p.fromUserId || null;
  const toId   = p.toUid   || p.toUserId   || null;

  if (!fromId || !toId) {
    throw new Error(`Missing participant IDs on proposal: fromId=${fromId}, toId=${toId}`);
  }

  const participantIds = [fromId, toId];

  // Check whether the room already exists. Use toId (the accepter / current user)
  // in array-contains so the Firestore read rule is satisfied.
  const { auth: firebaseAuth } = await import('./firebase.js');
  const currentUid = firebaseAuth.currentUser?.uid;
  const queryUid = currentUid || toId;

  try {
    const existQ = query(
      collection(db, 'chats'),
      where('tradeId', '==', p.id),
      where('participantIds', 'array-contains', queryUid)
    );
    const existSnap = await getDocs(existQ);
    if (!existSnap.empty) {
      return { id: existSnap.docs[0].id, ...existSnap.docs[0].data() };
    }
  } catch (checkErr) {
    // Log but don't swallow — if it's a real permissions error we'll surface it below
    console.warn('Chat existence check failed, attempting create anyway:', checkErr.message);
  }

  const room = {
    tradeId:           String(p.id),
    tradeType:         p.requestType || 'proposal',
    participantIds,
    participantEmails: [p.fromEmail, p.toEmail].filter(Boolean),
    fromUid:           fromId,
    toUid:             toId,
    readBy:            {},
    closed:            false,
    lastMessage:       '',
    lastUpdated:       serverTimestamp(),
    createdAt:         serverTimestamp(),
  };

  // This will throw with the real Firestore error if rules block it.
  const roomRef = await addDoc(collection(db, 'chats'), room);
  return { id: roomRef.id, ...room };
}

export async function loadChatRooms(userId) {
  // NOTE: combining array-contains with orderBy requires a composite Firestore index.
  // To avoid that dependency we fetch without orderBy and sort client-side.
  const q = query(
    collection(db, 'chats'),
    where('participantIds', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  const rooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Sort newest-first by lastUpdated (Firestore Timestamp or millis)
  rooms.sort((a, b) => {
    const ta = a.lastUpdated?.toMillis?.() ?? a.lastUpdated ?? 0;
    const tb = b.lastUpdated?.toMillis?.() ?? b.lastUpdated ?? 0;
    return tb - ta;
  });
  return rooms;
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
    deliveredAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: text.trim(),
    lastUpdated: serverTimestamp(),
  });
}

export async function markChatAsRead(chatId, userId) {
  if (!chatId || !userId) return;
  await updateDoc(doc(db, 'chats', chatId), {
    [`readBy.${userId}`]: serverTimestamp(),
  });
}

export async function concludeTrade(chatId) {
  if (!chatId) return null;
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return null;
  const chat = chatSnap.data();

  // Only update the chat document — we do NOT update the proposal here because
  // the Firestore proposal update rule only allows status in ['accepted','rejected']
  // and affectedKeys hasOnly ['status','updatedAt','responseMessage'].
  // Writing 'concluded' or 'concludedAt' would be rejected with permission-denied.
  const updates = {
    closed: true,
    closedAt: serverTimestamp(),
    lastMessage: 'Trade concluded',
    lastUpdated: serverTimestamp(),
  };
  await updateDoc(chatRef, updates);
  return { id: chatId, ...chat, ...updates };
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
    // Get sent proposals that were accepted, concluded, or rejected
    const sentQ = query(
      collection(db, 'proposals'),
      where('fromUserId', '==', userId),
      where('status', 'in', ['accepted', 'rejected', 'concluded'])
    );
    
    // Get received proposals that were accepted, concluded, or rejected
    const receivedQ = query(
      collection(db, 'proposals'),
      where('toUserId', '==', userId),
      where('status', 'in', ['accepted', 'rejected', 'concluded'])
    );
    
    const [sentSnap, receivedSnap] = await Promise.all([
      getDocs(sentQ),
      getDocs(receivedQ)
    ]);
    
    const trades = [
      ...sentSnap.docs.map(d => ({
        ...d.data(),
        direction: 'sent',
        state: d.data().status === 'accepted' ? 'ongoing' : d.data().status || 'unknown',
        timestamp: (d.data().concludedAt?.toMillis?.() ?? d.data().createdAt?.toMillis?.()) || 0
      })),
      ...receivedSnap.docs.map(d => ({
        ...d.data(),
        direction: 'received',
        state: d.data().status === 'accepted' ? 'ongoing' : d.data().status || 'unknown',
        timestamp: (d.data().concludedAt?.toMillis?.() ?? d.data().createdAt?.toMillis?.()) || 0
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