import test from 'node:test';
import assert from 'node:assert/strict';

import {
  catalogueCollections,
  catalogueCards,
  getCollectionById,
  getCollectionCards,
  getCatalogueItemByCode,
  normalizeCollectionItem,
} from './catalogue.js';

test('registered catalogue collections come from real local data and appear once', () => {
  assert.ok(Array.isArray(catalogueCollections));
  assert.ok(catalogueCollections.length > 0);
  const ids = catalogueCollections.map((collection) => collection.id);
  assert.equal(new Set(ids).size, ids.length);

  const footballSet = getCollectionById('topps-ucc-2024-25');
  assert.ok(footballSet);
  assert.equal(footballSet.title, 'Topps UEFA Club Competitions');
  assert.equal(footballSet.totalCards, footballSet.cards.length);
});

test('catalogue cards are unique across collections and collection cards stay scoped', () => {
  const seen = new Map();
  for (const card of catalogueCards) {
    assert.ok(!seen.has(card.code), `duplicate card code found: ${card.code}`);
    seen.set(card.code, card);
  }

  const collectionCards = getCollectionCards('topps-ucc-2024-25');
  assert.ok(Array.isArray(collectionCards));
  assert.ok(collectionCards.length > 0);
  assert.ok(collectionCards.every((card) => card.collectionId === 'topps-ucc-2024-25'));
});

test('legacy card codes resolve into the collection-aware catalogue and remain backwards compatible', () => {
  const match = getCatalogueItemByCode('topps-ucc-2024-25-base-1');
  assert.ok(match);
  assert.equal(match.collectionId, 'topps-ucc-2024-25');

  const normalized = normalizeCollectionItem({ code: 'topps-ucc-2024-25-base-1', owned: true });
  assert.ok(normalized);
  assert.equal(normalized.code, 'topps-ucc-2024-25:topps-ucc-2024-25-base-1');
  assert.equal(normalized.owned, true);
  assert.equal(normalized.collectionId, 'topps-ucc-2024-25');
});

test('legacy entries without a matching code remain preserved as a legacy card entry', () => {
  const normalized = normalizeCollectionItem({ name: 'Legacy Player', team: 'Legacy Club', owned: true });
  assert.ok(normalized);
  assert.equal(normalized.legacy, true);
  assert.equal(normalized.owned, true);
  assert.equal(normalized.name, 'Legacy Player');
});
