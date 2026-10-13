import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  doc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { catalogueCards } from './catalogue.js';
import {
  getPublicProfileByUid,
  searchPublicProfiles,
} from './profiles.js';

const VALID_PROPOSAL_STATUSES = new Set(['pending', 'accepted', 'rejected', 'concluded']);
const VALID_LISTING_TYPES = new Set(['duplicates', 'wanted', 'both']);
const MAX_LISTING_ITEMS = 200;

function currentUid() {
  return auth?.currentUser?.uid || null;
}

function isValidUid(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim() !== 'undefined';
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeCardRef(cardLike, fieldName = 'card') {
  const value = cardLike && typeof cardLike === 'object' ? cardLike : { code: String(cardLike || '') };
  const code = normalizeText(value.code || value.cardId || value.id || '', '').replace(/^#/, '');
  if (!code) {
    throw new Error(`${fieldName} is required.`);
  }

  const supported = catalogueCards.some(item => item.code === code || item.cardId === code);
  if (!supported) {
    throw new Error(`Unsupported card ID in ${fieldName}: ${code}`);
  }

  return {
    code,
    name: normalizeText(value.name || value.title || '', code),
    team: normalizeText(value.team || value.teamName || '', ''),
    qty: Number(value.qty || value.quantity || 1) || 1,
  };
}

function normalizeListingArray(items, fieldName = 'items') {
  if (!Array.isArray(items)) {
    throw new Error(`${fieldName} must be an array.`);
  }
  if (items.length > MAX_LISTING_ITEMS) {
    throw new Error(`${fieldName} exceeds the maximum supported length.`);
  }

  return items.map((item, index) => {
    const normalized = normalizeCardRef(item, `${fieldName}[${index}]`);
    if (normalized.qty < 1 || normalized.qty > 99) {
      throw new Error(`${fieldName}[${index}] quantity must be between 1 and 99.`);
    }
    return normalized;
  });
}

export function sanitizePublicBoardEntry(input, authenticatedUid) {
  if (!input || typeof input !== 'object') {
    throw new Error('Trade board payload is invalid.');
  }

  const ownerUid = String(input.ownerUid || input.uid || authenticatedUid || '').trim();
  if (!isValidUid(ownerUid)) {
    throw new Error('A valid owner UID is required for a public listing.');
  }

  if (authenticatedUid && ownerUid !== authenticatedUid) {
    throw new Error('Listing ownership cannot be changed from the client.');
  }

  const listingType = (input.listingType || 'duplicates').toLowerCase();
  if (!VALID_LISTING_TYPES.has(listingType)) {
    throw new Error('Unsupported listing type.');
  }

  const dups = normalizeListingArray(input.dups || [], 'dups');
  const missing = normalizeListingArray(input.missing || [], 'missing');

  return {
    uid: ownerUid,
    ownerUid,
    displayName: normalizeText(input.displayName || input.name || 'Collector', 'Collector'),
    avatarUrl: typeof input.avatarUrl === 'string' && /^https?:\/\//i.test(input.avatarUrl.trim()) ? input.avatarUrl.trim() : '',
    listingType,
    dups,
    missing,
    createdAt: input.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function sanitizeProposalInput(input, authenticatedUid) {
  if (!input || typeof input !== 'object') {
    throw new Error('Proposal payload is invalid.');
  }

  const senderUid = normalizeText(input.senderUid || input.fromUid || input.fromUserId || authenticatedUid || '', '');
  const recipientUid = normalizeText(input.recipientUid || input.toUid || input.toUserId || '', '');
  if (!senderUid || !recipientUid) {
    throw new Error('Both sender and recipient UIDs are required.');
  }
  if (senderUid !== authenticatedUid) {
    throw new Error('A user cannot create a proposal on behalf of another sender.');
  }
  if (senderUid === recipientUid) {
    throw new Error('A user cannot trade with themselves.');
  }

  const requestType = normalizeText(input.requestType || 'proposal', 'proposal');
  if (requestType !== 'proposal' && requestType !== 'interest') {
    throw new Error('Unsupported proposal request type.');
  }

  const giveCard = normalizeCardRef(input.giveCard || input.giveCode || input.give || input.giveItem, 'giveCard');
  const wantCard = normalizeCardRef(input.wantCard || input.wantCode || input.want || input.wantItem, 'wantCard');

  const message = normalizeText(input.message || '', '').slice(0, 500);
  const proposal = {
    senderUid,
    recipientUid,
    senderEmail: normalizeText(input.senderEmail || input.fromEmail || auth?.currentUser?.email || '', ''),
    recipientEmail: normalizeText(input.recipientEmail || input.toEmail || '', ''),
    giveCode: giveCard.code,
    giveName: giveCard.name,
    giveTeam: giveCard.team,
    wantCode: wantCard.code,
    wantName: wantCard.name,
    wantTeam: wantCard.team,
    message,
    requestType,
    attachedWantList: Array.isArray(input.attachedWantList) ? input.attachedWantList.slice(0, 20) : [],
    status: 'pending',
    createdAt: input.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return proposal;
}

function validateProposalStatusTransition(proposal, nextStatus, actorUid) {
  if (!proposal || typeof proposal !== 'object') {
    throw new Error('Proposal document is missing.');
  }

  if (!VALID_PROPOSAL_STATUSES.has(nextStatus)) {
    throw new Error('Unsupported proposal status.');
  }

  if (proposal.status && proposal.status !== 'pending') {
    throw new Error('Only pending proposals may be accepted or rejected.');
  }

  if (actorUid !== proposal.recipientUid) {
    throw new Error('Only the recipient may accept or reject a pending proposal.');
  }
}

export function normalizeParticipantIds(participantIds = []) {
  const values = Array.isArray(participantIds)
    ? participantIds
        .filter(value => value !== undefined && value !== null)
        .map(value => String(value).trim())
        .filter(Boolean)
    : [];

  const unique = [...new Set(values)];
  if (unique.length !== 2) {
    throw new Error('A chat must include exactly two unique participants.');
  }

  return unique;
}

export function getProposalParticipants(proposal = {}) {
  const senderUid = String(proposal.senderUid || proposal.fromUid || proposal.fromUserId || '').trim();
  const recipientUid = String(proposal.recipientUid || proposal.toUid || proposal.toUserId || '').trim();

  if (!senderUid || !recipientUid) {
    throw new Error('A proposal must include both sender and recipient UIDs.');
  }
  if (senderUid === recipientUid) {
    throw new Error('A user cannot trade with themselves.');
  }

  return {
    senderUid,
    recipientUid,
    participantIds: normalizeParticipantIds([senderUid, recipientUid]),
  };
}

export function assertChatParticipantAccess(chat, viewerUid) {
  if (!viewerUid) {
    throw new Error('A signed-in user is required to access this chat.');
  }
  if (!chat || typeof chat !== 'object') {
    throw new Error('Chat room not found.');
  }

  const participantIds = normalizeParticipantIds(chat.participantIds || []);
  if (!participantIds.includes(viewerUid)) {
    throw new Error('You are not a participant in this chat.');
  }

  return participantIds;
}

export function validateChatMessagePayload(payload = {}, senderUid, chat) {
  const currentUser = currentUid();
  const finalSenderId = String(senderUid || currentUser || '').trim();
  if (!finalSenderId) {
    throw new Error('A sender UID is required.');
  }
  if (currentUser && finalSenderId !== currentUser) {
    throw new Error('Message sender does not match the authenticated user.');
  }

  const participants = assertChatParticipantAccess(chat, finalSenderId);
  if (!participants.includes(finalSenderId)) {
    throw new Error('Message sender must be a participant in the chat.');
  }

  const messageType = String(payload.type || 'text').trim().toLowerCase();
  if (!['text', 'system'].includes(messageType)) {
    throw new Error('Unsupported message type.');
  }

  const textValue = typeof payload.text === 'string' ? payload.text.trim() : '';
  if (!textValue) {
    throw new Error('Message text is required.');
  }
  if (textValue.length > 2000) {
    throw new Error('Message text exceeds the 2000 character limit.');
  }
  if (!payload.createdAt) {
    throw new Error('Message createdAt timestamp is required.');
  }

  const message = {
    senderId: finalSenderId,
    senderEmail: typeof payload.senderEmail === 'string' ? payload.senderEmail.trim() : '',
    type: messageType,
    text: textValue,
    createdAt: payload.createdAt,
    deliveredAt: payload.deliveredAt || payload.createdAt,
  };

  return message;
}

export function validateChatMetadataUpdate(chat, actorUid, updates = {}) {
  const allowed = new Set(['readBy', 'closed', 'closedAt', 'lastMessage', 'lastUpdated', 'updatedAt']);
  const keys = Object.keys(updates || {});
  const invalid = keys.filter(key => !allowed.has(key));
  if (invalid.length) {
    throw new Error(`Unauthorized chat metadata fields: ${invalid.join(', ')}`);
  }

  const participants = assertChatParticipantAccess(chat, actorUid);
  if (keys.some(key => key === 'readBy') && !participants.includes(actorUid)) {
    throw new Error('Only chat participants can update read receipts.');
  }

  return true;
}

/**
 * Public-profile-only lookup.
 * The public profile schema does not store email addresses, so email-based lookup is intentionally
 * privacy-preserving by name lookup instead of private email search.
 */
export async function findUserByEmail(email) {
  const search = String(email || '').trim();
  if (!search) return null;

  const candidates = await searchPublicProfiles(search);
  const exact = candidates.find(profile => profile.displayName.toLowerCase() === search.toLowerCase());
  const chosen = exact || candidates[0] || null;
  if (!chosen) return null;

  return { uid: chosen.uid, data: chosen };
}

/** Send a trade proposal to another user. */
export async function sendProposal(input = {}) {
  const currentUser = currentUid();
  if (!currentUser) {
    throw new Error('You must be signed in to send a trade proposal.');
  }

  const sanitized = sanitizeProposalInput(input, currentUser);
  const recipientProfile = await getDoc(doc(db, 'publicProfiles', sanitized.recipientUid));
  if (!recipientProfile.exists()) {
    throw new Error('Recipient profile does not exist.');
  }

  const listingDoc = await getDoc(doc(db, 'tradeBoard', sanitized.recipientUid));
  if (!listingDoc.exists() && !input.listingUid) {
    // The app can send a proposal without a public listing if the recipient can still be contacted.
    // This is intentionally allowed, but the recipient must still exist in publicProfiles.
  }

  const proposalRef = await addDoc(collection(db, 'proposals'), {
    ...sanitized,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { id: proposalRef.id, ...sanitized, status: 'pending' };
}

/** Fetch all pending proposals addressed to the current user ID. */
export async function loadIncomingProposals(toUserId) {
  const q = query(collection(db, 'proposals'), where('recipientUid', '==', toUserId), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Accept or reject a proposal by ID. */
export async function respondToProposal(propId, action, actorUid = currentUid()) {
  if (!actorUid) {
    throw new Error('You must be signed in to respond to a proposal.');
  }
  if (!['accept', 'reject'].includes(action)) {
    throw new Error('Unsupported proposal action.');
  }

  const ref = doc(db, 'proposals', propId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Proposal does not exist.');
  }

  const proposal = snap.data();
  const participants = getProposalParticipants(proposal);
  if (proposal.status !== 'pending') {
    throw new Error('Only pending proposals can be accepted or rejected.');
  }
  if (participants.recipientUid !== actorUid) {
    throw new Error('Only the recipient may respond to this proposal.');
  }

  const nextStatus = action === 'accept' ? 'accepted' : 'rejected';
  validateProposalStatusTransition(proposal, nextStatus, actorUid);

  await updateDoc(ref, {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });

  return { id: propId, ...proposal, status: nextStatus };
}

export async function acceptProposalAndCreateChat(propId, actorUid = currentUid()) {
  const updated = await respondToProposal(propId, 'accept', actorUid);
  return createChatRoomForProposal({ id: propId, ...updated });
}

/** Create or return an existing chat room for an accepted proposal. */
export async function createChatRoomForProposal(proposal) {
  if (!proposal || !proposal.id) throw new Error('No proposal ID provided');

  const actorUid = currentUid();
  const freshSnap = await getDoc(doc(db, 'proposals', proposal.id));
  if (!freshSnap.exists()) throw new Error('Invalid proposal reference: requested proposal was not found.');
  const p = { id: freshSnap.id, ...freshSnap.data() };

  const { senderUid, recipientUid, participantIds } = getProposalParticipants(p);
  if (p.status !== 'accepted') {
    throw new Error('Only accepted proposals can create a chat room.');
  }
  if (actorUid && ![senderUid, recipientUid].includes(actorUid)) {
    throw new Error('Only a participant in the proposal may create the chat room.');
  }

  const proposalKey = String(p.id);
  const existingQuery = query(collection(db, 'chats'), where('proposalId', '==', proposalKey));
  const existingSnap = await getDocs(existingQuery);
  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    const existingData = existingDoc.data();
    try {
      const existingParticipants = normalizeParticipantIds(existingData.participantIds || []);
      if (existingParticipants[0] !== participantIds[0] || existingParticipants[1] !== participantIds[1]) {
        throw new Error('A conflicting chat room already exists for this proposal.');
      }
      return { id: existingDoc.id, ...existingData };
    } catch (err) {
      throw new Error(`Duplicate chat room conflict: ${err.message}`);
    }
  }

  const room = {
    proposalId: proposalKey,
    tradeId: proposalKey,
    tradeType: p.requestType || 'proposal',
    participantIds,
    participantEmails: [p.senderEmail, p.recipientEmail].filter(Boolean),
    senderUid,
    recipientUid,
    readBy: {},
    closed: false,
    lastMessage: '',
    lastUpdated: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const roomRef = await addDoc(collection(db, 'chats'), room);
  return { id: roomRef.id, ...room };
}

export async function loadChatRooms(userId) {
  const actorUid = currentUid();
  if (!actorUid) {
    throw new Error('You must be signed in to view chats.');
  }
  if (actorUid !== userId) {
    throw new Error('You cannot view another user\'s chat list.');
  }

  const q = query(collection(db, 'chats'), where('participantIds', 'array-contains', userId));
  const snap = await getDocs(q);
  const rooms = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(room => {
      try {
        const participantIds = normalizeParticipantIds(room.participantIds || []);
        return participantIds.includes(userId);
      } catch {
        return false;
      }
    });

  rooms.sort((a, b) => {
    const ta = a.lastUpdated?.toMillis?.() ?? a.lastUpdated ?? 0;
    const tb = b.lastUpdated?.toMillis?.() ?? b.lastUpdated ?? 0;
    return tb - ta;
  });
  return rooms;
}

export async function loadChatMessages(chatId, viewerUid = currentUid()) {
  if (!chatId) {
    throw new Error('A chat ID is required.');
  }
  if (!viewerUid) {
    throw new Error('You must be signed in to read messages.');
  }

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) {
    throw new Error('Chat room was not found.');
  }

  const chat = chatSnap.data();
  assertChatParticipantAccess(chat, viewerUid);

  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function sendChatMessage(chatId, senderId, senderEmail, text, messageType = 'text') {
  const currentUser = currentUid();
  if (!currentUser) {
    throw new Error('You must be signed in to send a message.');
  }
  if (!chatId) {
    throw new Error('A chat ID is required.');
  }
  const finalSenderId = String(senderId || currentUser || '').trim();
  if (finalSenderId !== currentUser) {
    throw new Error('Message sender does not match the authenticated user.');
  }

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) {
    throw new Error('Chat room not found.');
  }

  const chat = chatSnap.data();
  const participants = assertChatParticipantAccess(chat, finalSenderId);
  if (!participants.includes(finalSenderId)) {
    throw new Error('Sender must be a participant in the chat.');
  }

  const message = validateChatMessagePayload({
    type: messageType,
    text,
    senderEmail,
    createdAt: serverTimestamp(),
    deliveredAt: serverTimestamp(),
  }, finalSenderId, chat);

  const messageRef = await addDoc(collection(db, 'chats', chatId, 'messages'), message);
  await updateDoc(chatRef, {
    lastMessage: message.text,
    lastUpdated: serverTimestamp(),
  });

  return { id: messageRef.id, ...message };
}

export async function markChatAsRead(chatId, userId, actorUid = currentUid()) {
  if (!chatId || !userId) {
    throw new Error('A chat ID and user ID are required.');
  }
  if (!actorUid) {
    throw new Error('You must be signed in to mark a chat as read.');
  }

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) {
    throw new Error('Chat room not found.');
  }

  const chat = chatSnap.data();
  validateChatMetadataUpdate(chat, actorUid, { readBy: { [userId]: serverTimestamp() } });
  if (actorUid !== userId) {
    throw new Error('You can only update your own read receipt.');
  }

  await updateDoc(chatRef, {
    [`readBy.${userId}`]: serverTimestamp(),
  });
  return { id: chatId, readBy: { [userId]: serverTimestamp() } };
}

export async function concludeTrade(chatId, actorUid = currentUid()) {
  if (!chatId) return null;
  if (!actorUid) {
    throw new Error('You must be signed in to conclude a trade.');
  }

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return null;
  const chat = chatSnap.data();

  validateChatMetadataUpdate(chat, actorUid, {
    closed: true,
    closedAt: serverTimestamp(),
    lastMessage: 'Trade concluded',
    lastUpdated: serverTimestamp(),
  });

  const updates = {
    closed: true,
    closedAt: serverTimestamp(),
    lastMessage: 'Trade concluded',
    lastUpdated: serverTimestamp(),
  };
  await updateDoc(chatRef, updates);
  return { id: chatId, ...chat, ...updates };
}

/**
 * Public trade board listing creation/update.
 * This is intentionally limited to public data only. No private collection fields are allowed.
 */
export async function publishToBoard(payloadOrEmail, ownerId, dups, missing) {
  const currentUserUid = currentUid();
  if (!currentUserUid) {
    throw new Error('You must be signed in to publish a listing.');
  }

  const payload = typeof payloadOrEmail === 'object' && payloadOrEmail !== null
    ? payloadOrEmail
    : {
        ownerUid: ownerId || currentUserUid,
        uid: ownerId || currentUserUid,
        dups,
        missing,
      };

  const sanitized = sanitizePublicBoardEntry(payload, currentUserUid);
  const existing = await getDoc(doc(db, 'tradeBoard', sanitized.ownerUid));
  if (existing.exists() && existing.data().ownerUid !== currentUserUid) {
    throw new Error('A listing cannot be transferred to another owner.');
  }

  await setDoc(doc(db, 'tradeBoard', sanitized.ownerUid), {
    ...sanitized,
    createdAt: existing.exists() ? existing.data().createdAt || sanitized.createdAt : sanitized.createdAt,
    updatedAt: serverTimestamp(),
  });
  return { id: sanitized.ownerUid, ...sanitized, updatedAt: new Date() };
}

/** Fetch all entries from the public trade board. */
export async function fetchPublicBoard() {
  const snap = await getDocs(collection(db, 'tradeBoard'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Search public profiles by display name instead of private email. */
export async function searchUsersByEmail(searchQuery) {
  const results = await searchPublicProfiles(searchQuery);
  return results.map(profile => ({
    uid: profile.uid,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl || '',
    completionPct: profile.completionPct || 0,
  }));
}

/** Read a public trade listing by uid. */
export async function getPublicTradeListing(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'tradeBoard', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() };
}

/**
 * Read the current user's private doc from the private store.
 * Do not use this for other-user discovery.
 */
export async function getPrivateCollectionForUser(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    uid: snap.id,
    email: data.email,
    stickers: data.stickers || [],
    completionPct: data.completionPct || 0,
  };
}

/** Get a specific user's public trade listing by uid, or a privacy-safe fallback. */
export async function getUserCollection(identifier) {
  const exactUid = typeof identifier === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(identifier) ? identifier : null;
  const profile = exactUid ? await getPublicProfileByUid(exactUid) : await findUserByEmail(identifier);
  if (!profile) return null;

  const publicId = profile.uid || profile.data?.uid || null;
  const listing = publicId ? await getPublicTradeListing(publicId) : null;

  return {
    uid: publicId,
    email: null,
    displayName: profile.displayName || profile.data?.displayName || 'Collector',
    stickers: Array.isArray(listing?.dups) ? listing.dups.map(item => ({
      code: item.code,
      name: item.name,
      team: item.team,
      dupCount: item.qty || 1,
      duplicate: true,
      owned: true,
    })) : [],
    completionPct: profile.completionPct || listing?.completionPct || 0,
  };
}

/** Load all trade history (both sent and received proposals). */
export async function loadAllTradeHistory(userId) {
  try {
    const sentQ = query(collection(db, 'proposals'), where('senderUid', '==', userId), where('status', 'in', ['accepted', 'rejected', 'concluded']));
    const receivedQ = query(collection(db, 'proposals'), where('recipientUid', '==', userId), where('status', 'in', ['accepted', 'rejected', 'concluded']));

    const [sentSnap, receivedSnap] = await Promise.all([
      getDocs(sentQ),
      getDocs(receivedQ)
    ]);

    const trades = [
      ...sentSnap.docs.map(d => ({
        ...d.data(),
        direction: 'sent',
        state: d.data().status === 'accepted' ? 'ongoing' : d.data().status || 'unknown',
        timestamp: (d.data().updatedAt?.toMillis?.() ?? d.data().createdAt?.toMillis?.()) || 0
      })),
      ...receivedSnap.docs.map(d => ({
        ...d.data(),
        direction: 'received',
        state: d.data().status === 'accepted' ? 'ongoing' : d.data().status || 'unknown',
        timestamp: (d.data().updatedAt?.toMillis?.() ?? d.data().createdAt?.toMillis?.()) || 0
      }))
    ];

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