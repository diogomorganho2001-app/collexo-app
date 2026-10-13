import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDisplayName,
  normalizeAvatarUrl,
  sanitizePublicProfileInput,
  createPublicProfilePatch,
} from './profiles.js';

test('sanitizePublicProfileInput keeps only public profile data', () => {
  const profile = sanitizePublicProfileInput({
    uid: 'abc-123',
    displayName: '  Sarah  Collector  ',
    name: 'Ignored name',
    avatarUrl: 'https://example.com/avatar.png',
    bio: 'Collector of rare cards',
    email: 'sarah@example.com',
    stickers: [{ code: 'CARD-1' }],
    completionPct: 65,
  }, 'abc-123');

  assert.equal(profile.uid, 'abc-123');
  assert.equal(profile.displayName, 'Sarah Collector');
  assert.equal(profile.avatarUrl, 'https://example.com/avatar.png');
  assert.equal(profile.bio, 'Collector of rare cards');
  assert.equal(profile.completionPct, 65);
  assert.ok(!('email' in profile));
  assert.ok(!('stickers' in profile));
});

test('createPublicProfilePatch rejects private fields and UID edits', () => {
  assert.throws(() => createPublicProfilePatch({ uid: 'other-user' }), /UID/i);
  assert.throws(() => createPublicProfilePatch({ email: 'player@example.com' }), /private/i);

  const patch = createPublicProfilePatch({
    displayName: '  Nova  ',
    avatarUrl: 'https://example.com/nova.png',
    bio: 'Bumping up my collection ',
    completionPct: 25,
  });

  assert.equal(patch.displayName, 'Nova');
  assert.equal(patch.avatarUrl, 'https://example.com/nova.png');
  assert.equal(patch.bio, 'Bumping up my collection');
  assert.equal(patch.completionPct, 25);
  assert.ok(patch.updatedAt);
});

test('display-name and avatar sanitizers fall back safely', () => {
  assert.equal(normalizeDisplayName('   '), 'Collector');
  assert.equal(normalizeDisplayName('  Alex   Turner  '), 'Alex Turner');
  assert.equal(normalizeAvatarUrl('not-a-url'), '');
  assert.equal(normalizeAvatarUrl('https://example.com/pic.png'), 'https://example.com/pic.png');
});
