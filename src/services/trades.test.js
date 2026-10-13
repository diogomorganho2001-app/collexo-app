import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizePublicBoardEntry,
  sanitizeProposalInput,
  normalizeParticipantIds,
  getProposalParticipants,
  assertChatParticipantAccess,
  validateChatMessagePayload,
  validateChatMetadataUpdate,
} from './trades.js';

test('sanitizePublicBoardEntry requires authenticated ownership and rejects forged owner IDs', () => {
  assert.throws(() => sanitizePublicBoardEntry({ ownerUid: 'other-user', dups: [{ code: 'topps-ucc-2024-25-base-1', qty: 1 }] }, 'current-user'), /ownership cannot be changed/i);
  assert.throws(() => sanitizePublicBoardEntry({ dups: [] }, ''), /valid owner UID/i);

  const entry = sanitizePublicBoardEntry({
    ownerUid: 'current-user',
    displayName: '  Collector  ',
    avatarUrl: 'https://example.com/avatar.png',
    listingType: 'duplicates',
    dups: [{ code: 'topps-ucc-2024-25-base-1', qty: 2, name: 'Rayan Cherki', team: 'Manchester City' }],
    missing: [{ code: 'topps-ucc-2024-25-base-2', qty: 1, name: 'Bernardo Silva', team: 'Manchester City' }],
  }, 'current-user');

  assert.equal(entry.uid, 'current-user');
  assert.equal(entry.ownerUid, 'current-user');
  assert.equal(entry.displayName, 'Collector');
  assert.equal(entry.listingType, 'duplicates');
  assert.equal(entry.dups[0].code, 'topps-ucc-2024-25-base-1');
  assert.equal(entry.missing[0].code, 'topps-ucc-2024-25-base-2');
});

test('sanitizeProposalInput blocks self-trades and unauthorised sender impersonation', () => {
  assert.throws(() => sanitizeProposalInput({
    fromUid: 'user-a',
    toUid: 'user-a',
    giveCode: 'topps-ucc-2024-25-base-1',
    wantCode: 'topps-ucc-2024-25-base-2',
  }, 'user-a'), /trade with themselves/i);

  assert.throws(() => sanitizeProposalInput({
    fromUid: 'user-a',
    toUid: 'user-b',
    giveCode: 'topps-ucc-2024-25-base-1',
    wantCode: 'topps-ucc-2024-25-base-2',
  }, 'user-c'), /cannot create a proposal on behalf of another sender/i);

  const proposal = sanitizeProposalInput({
    fromUid: 'user-a',
    toUid: 'user-b',
    giveCode: 'topps-ucc-2024-25-base-1',
    wantCode: 'topps-ucc-2024-25-base-2',
    message: ' Looking for this card ',
    requestType: 'proposal',
  }, 'user-a');

  assert.equal(proposal.senderUid, 'user-a');
  assert.equal(proposal.recipientUid, 'user-b');
  assert.equal(proposal.giveCode, 'topps-ucc-2024-25-base-1');
  assert.equal(proposal.wantCode, 'topps-ucc-2024-25-base-2');
  assert.equal(proposal.message, 'Looking for this card');
  assert.equal(proposal.status, 'pending');
});

test('chat access and message validation enforce participant-only rules', () => {
  assert.throws(() => normalizeParticipantIds(['user-a', 'user-a']), /exactly two unique participants/i);
  assert.throws(() => getProposalParticipants({ senderUid: 'user-a' }), /both sender and recipient/i);
  assert.throws(() => assertChatParticipantAccess({ participantIds: ['user-a', 'user-b'] }, 'user-c'), /not a participant/i);
  assert.throws(() => validateChatMessagePayload({ type: 'text', text: 'hello', createdAt: new Date() }, 'user-c', { participantIds: ['user-a', 'user-b'] }), /match the authenticated user|not a participant/i);

  const validMessage = validateChatMessagePayload({
    type: 'text',
    text: '  Hello from user-a  ',
    senderEmail: 'user-a@example.com',
    createdAt: new Date('2026-01-01T12:00:00Z'),
    deliveredAt: new Date('2026-01-01T12:00:01Z'),
  }, 'user-a', { participantIds: ['user-a', 'user-b'] });

  assert.equal(validMessage.senderId, 'user-a');
  assert.equal(validMessage.type, 'text');
  assert.equal(validMessage.text, 'Hello from user-a');
  assert.equal(validMessage.senderEmail, 'user-a@example.com');
});

test('chat metadata updates and duplicate participant checks are rejected when unauthorized', () => {
  const chat = { participantIds: ['user-a', 'user-b'], readBy: {} };
  assert.throws(() => validateChatMetadataUpdate(chat, 'user-c', { readBy: { 'user-c': new Date() } }), /not a participant/i);
  assert.throws(() => validateChatMetadataUpdate(chat, 'user-a', { participantIds: ['user-a', 'user-b'] }), /Unauthorized chat metadata fields/i);

  const allowed = validateChatMetadataUpdate(chat, 'user-a', { readBy: { 'user-a': new Date() } });
  assert.equal(allowed, true);
});

test('canonical two-person chat participants are stable for valid proposal ownership', () => {
  const proposal = getProposalParticipants({ senderUid: 'user-b', recipientUid: 'user-a' });
  assert.deepEqual(proposal.participantIds, ['user-b', 'user-a']);
  assert.equal(proposal.senderUid, 'user-b');
  assert.equal(proposal.recipientUid, 'user-a');
});
