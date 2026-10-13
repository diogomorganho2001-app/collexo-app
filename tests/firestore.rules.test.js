import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

const projectId = 'demo-collexo';
let testEnv;

function authDb(uid, email = `${uid}@example.com`) {
  return testEnv.authenticatedContext(uid, { email }).firestore();
}

function unauthDb() {
  return testEnv.unauthenticatedContext().firestore();
}

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

test('private users docs are owner-only and reject forged ownership', async () => {
  const alice = authDb('user-a', 'alice@example.com');
  const bob = authDb('user-b', 'bob@example.com');

  const privateDoc = {
    email: 'alice@example.com',
    stickers: [{ code: 'card-1', name: 'Sample', team: 'City', owned: true }],
    tradeHistory: [],
    milestonesSeen: {},
    completionPct: 10,
  };

  await assertSucceeds(setDoc(doc(alice, 'users', 'user-a'), privateDoc));
  await assertSucceeds(getDoc(doc(alice, 'users', 'user-a')));
  await assertFails(getDoc(doc(bob, 'users', 'user-a')));
  await assertFails(setDoc(doc(alice, 'users', 'user-a'), {
    ...privateDoc,
    uid: 'forged-owner',
  }));
});

test('public profiles are public-only and reject private fields', async () => {
  const alice = authDb('user-a', 'alice@example.com');
  const bob = authDb('user-b', 'bob@example.com');
  const publicDoc = {
    uid: 'user-a',
    displayName: 'Alice',
    avatarUrl: 'https://example.com/alice.png',
    bio: 'Collector',
    isPublic: true,
    completionPct: 25,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await assertSucceeds(setDoc(doc(alice, 'publicProfiles', 'user-a'), publicDoc));
  await assertSucceeds(getDoc(doc(unauthDb(), 'publicProfiles', 'user-a')));
  await assertSucceeds(getDocs(query(collection(alice, 'publicProfiles'), where('isPublic', '==', true), limit(10))));
  await assertFails(setDoc(doc(alice, 'publicProfiles', 'user-b'), {
    ...publicDoc,
    uid: 'user-b',
  }));
  await assertFails(setDoc(doc(alice, 'publicProfiles', 'user-a'), {
    ...publicDoc,
    email: 'alice@example.com',
  }));
  await assertSucceeds(getDoc(doc(bob, 'publicProfiles', 'user-a')));
});

test('trade board writes are owner-bound and public reads are allowed', async () => {
  const alice = authDb('user-a', 'alice@example.com');
  const bob = authDb('user-b', 'bob@example.com');
  const unauth = unauthDb();

  const listing = {
    uid: 'user-a',
    ownerUid: 'user-a',
    displayName: 'Alice',
    avatarUrl: 'https://example.com/alice.png',
    listingType: 'duplicates',
    dups: [{ code: 'card-1', name: 'Card One', team: 'Team A', qty: 2 }],
    missing: [{ code: 'card-2', name: 'Card Two', team: 'Team B', qty: 1 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await assertSucceeds(setDoc(doc(alice, 'tradeBoard', 'user-a'), listing));
  await assertSucceeds(getDoc(doc(unauth, 'tradeBoard', 'user-a')));
  await assertFails(setDoc(doc(alice, 'tradeBoard', 'user-a'), {
    ...listing,
    ownerUid: 'user-b',
  }));
  await assertFails(setDoc(doc(bob, 'tradeBoard', 'user-a'), {
    ...listing,
    ownerUid: 'user-a',
  }));
});

test('proposal creation and participant-only reads are enforced', async () => {
  const alice = authDb('user-a', 'alice@example.com');
  const bob = authDb('user-b', 'bob@example.com');
  const carol = authDb('user-c', 'carol@example.com');

  await assertSucceeds(setDoc(doc(bob, 'publicProfiles', 'user-b'), {
    uid: 'user-b',
    displayName: 'Bob',
    avatarUrl: '',
    bio: '',
    isPublic: true,
    completionPct: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const proposalRef = await addDoc(collection(alice, 'proposals'), {
    senderUid: 'user-a',
    recipientUid: 'user-b',
    senderEmail: 'alice@example.com',
    recipientEmail: 'bob@example.com',
    giveCode: 'card-1',
    giveName: 'Card One',
    giveTeam: 'Team A',
    wantCode: 'card-2',
    wantName: 'Card Two',
    wantTeam: 'Team B',
    message: 'Looking for this card',
    requestType: 'proposal',
    attachedWantList: [],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await assertSucceeds(getDoc(doc(bob, 'proposals', proposalRef.id)));
  await assertFails(getDoc(doc(carol, 'proposals', proposalRef.id)));
  await assertFails(updateDoc(doc(alice, 'proposals', proposalRef.id), {
    status: 'accepted',
    updatedAt: new Date(),
  }));
  await assertSucceeds(updateDoc(doc(bob, 'proposals', proposalRef.id), {
    status: 'accepted',
    updatedAt: new Date(),
  }));
});

test('chat membership and message writes are restricted to participants', async () => {
  const alice = authDb('user-a', 'alice@example.com');
  const bob = authDb('user-b', 'bob@example.com');
  const carol = authDb('user-c', 'carol@example.com');

  await assertSucceeds(setDoc(doc(bob, 'publicProfiles', 'user-b'), {
    uid: 'user-b',
    displayName: 'Bob',
    avatarUrl: '',
    bio: '',
    isPublic: true,
    completionPct: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const proposalRef = await addDoc(collection(alice, 'proposals'), {
    senderUid: 'user-a',
    recipientUid: 'user-b',
    senderEmail: 'alice@example.com',
    recipientEmail: 'bob@example.com',
    giveCode: 'card-1',
    giveName: 'Card One',
    giveTeam: 'Team A',
    wantCode: 'card-2',
    wantName: 'Card Two',
    wantTeam: 'Team B',
    message: 'Looking for this card',
    requestType: 'proposal',
    attachedWantList: [],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await assertSucceeds(updateDoc(doc(bob, 'proposals', proposalRef.id), {
    status: 'accepted',
    updatedAt: new Date(),
  }));

  const chatRef = await addDoc(collection(alice, 'chats'), {
    proposalId: proposalRef.id,
    tradeId: proposalRef.id,
    tradeType: 'proposal',
    participantIds: ['user-a', 'user-b'],
    participantEmails: ['alice@example.com', 'bob@example.com'],
    senderUid: 'user-a',
    recipientUid: 'user-b',
    readBy: {},
    closed: false,
    lastMessage: '',
    lastUpdated: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await assertSucceeds(getDoc(doc(bob, 'chats', chatRef.id)));
  await assertFails(getDoc(doc(carol, 'chats', chatRef.id)));
  await assertSucceeds(addDoc(collection(alice, 'chats', chatRef.id, 'messages'), {
    senderId: 'user-a',
    senderEmail: 'alice@example.com',
    type: 'text',
    text: 'Hello from Alice',
    createdAt: new Date(),
    deliveredAt: new Date(),
  }));
  await assertFails(addDoc(collection(carol, 'chats', chatRef.id, 'messages'), {
    senderId: 'user-c',
    senderEmail: 'carol@example.com',
    type: 'text',
    text: 'Illegal message',
    createdAt: new Date(),
    deliveredAt: new Date(),
  }));
});
