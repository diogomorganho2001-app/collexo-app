import topsUcc2025Json from '../../data/sports/football/topps-ucc-2025-26.json' with { type: 'json' };

function safeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

function collectionIdFromSource(value, fallback = 'catalogue') {
  const raw = safeString(value || fallback).replace(/\s+/g, '-');
  return slugify(raw) || 'catalogue';
}

function buildCollectionAwareCode(collectionId, cardId) {
  const cleanCollection = collectionIdFromSource(collectionId, 'catalogue');
  const cleanCard = slugify(cardId || 'card');
  return `${cleanCollection}:${cleanCard}`;
}

function buildFallbackCollection() {
  return {
    id: 'catalogue',
    title: 'Sports Card Catalogue',
    sport: 'football',
    manufacturer: 'Unknown manufacturer',
    setName: 'Sports Card Catalogue',
    season: '',
    league: '',
    collectionType: 'trading cards',
    totalCards: 0,
    coverImage: '',
    sourcePath: '',
    cards: [],
  };
}

function normalizeCollectionData(filePath, fileData) {
  if (!fileData || typeof fileData !== 'object') return null;
  const setInfo = fileData.set || {};
  const sourceInfo = fileData.source || {};
  const rawCards = Array.isArray(fileData.cards) ? fileData.cards : [];
  const collectionId = collectionIdFromSource(setInfo.setId || sourceInfo.collectionId || sourceInfo.id || filePath, 'catalogue');
  const title = safeString(setInfo.name || sourceInfo.name || 'Sports Card Catalogue') || 'Sports Card Catalogue';
  const sport = safeString(setInfo.sport || sourceInfo.sport || 'football') || 'football';
  const manufacturer = safeString(sourceInfo.manufacturer || setInfo.manufacturer || 'Unknown manufacturer') || 'Unknown manufacturer';
  const season = safeString(setInfo.season || sourceInfo.season || '') || '';
  const league = safeString(setInfo.league || sourceInfo.league || '') || '';
  const collectionType = safeString(setInfo.type || sourceInfo.type || 'trading cards') || 'trading cards';
  const coverImage = safeString(setInfo.coverImage || sourceInfo.coverImage || fileData.coverImage || '') || '';

  const cards = rawCards.map((card, index) => {
    const cardId = safeString(card?.cardId) || `${collectionId}-${safeString(card?.cardNumber) || index + 1}`;
    const stableCode = buildCollectionAwareCode(collectionId, cardId);
    return {
      code: stableCode,
      cardId,
      collectionId,
      collectionTitle: title,
      name: safeString(card?.playerName) || safeString(card?.name) || `Card ${safeString(card?.cardNumber) || index + 1}`,
      team: safeString(card?.teamName) || safeString(card?.team) || 'Unknown team',
      cardNumber: safeString(card?.cardNumber),
      cardType: safeString(card?.cardType),
      variantName: safeString(card?.variantName),
      sport,
      manufacturer,
      setName: title,
      season,
      league,
      sourcePage: card?.sourcePage ?? null,
      owned: false,
      dupCount: 0,
      duplicate: false,
      wanted: false,
    };
  });

  return {
    id: collectionId,
    title,
    sport,
    manufacturer,
    setName: title,
    season,
    league,
    collectionType,
    totalCards: cards.length,
    coverImage,
    sourcePath: filePath,
    cards,
  };
}

const registeredCatalogueData = [
  {
    filePath: '../../data/sports/football/topps-ucc-2025-26.json',
    fileData: topsUcc2025Json,
  },
];

export const catalogueCollections = registeredCatalogueData
  .map(({ filePath, fileData }) => normalizeCollectionData(filePath, fileData))
  .filter(Boolean)
  .sort((left, right) => left.title.localeCompare(right.title));

const fallbackCollection = buildFallbackCollection();
const primaryCollection = catalogueCollections[0] || fallbackCollection;

export const catalogueMeta = {
  id: primaryCollection.id,
  name: primaryCollection.title,
  title: primaryCollection.title,
  sport: primaryCollection.sport,
  manufacturer: primaryCollection.manufacturer,
  setName: primaryCollection.setName,
  season: primaryCollection.season,
  league: primaryCollection.league,
  collectionType: primaryCollection.collectionType,
  totalCards: primaryCollection.totalCards,
  coverImage: primaryCollection.coverImage,
  sourcePath: primaryCollection.sourcePath,
};

export const catalogueCards = catalogueCollections.flatMap((collection) => collection.cards);

export function getCollectionById(collectionId) {
  if (!collectionId) return null;
  const key = String(collectionId).trim();
  return catalogueCollections.find((collection) =>
    collection.id === key ||
    collection.title === key ||
    collection.setName === key,
  ) || null;
}

export function getCollectionCards(collectionId) {
  const collection = getCollectionById(collectionId);
  return collection ? collection.cards : [];
}

export function getCatalogueItemByCode(code) {
  const value = safeString(code);
  if (!value) return null;

  return catalogueCards.find((item) => {
    const candidateCodes = [item.code, item.cardId, item.collectionId ? `${item.collectionId}:${item.cardId}` : ''];
    return candidateCodes.includes(value) || candidateCodes.includes(value.replace(/^.*:/, ''));
  }) || null;
}

export function deriveLegacyCode(item = {}) {
  const source = item.code || item.cardId || item.name || item.team || 'legacy-card';
  return `legacy-${slugify(source)}`;
}

function matchesCardByIdentity(card, item) {
  const itemCode = safeString(item?.code || item?.cardId || item?.id || '');
  if (itemCode) {
    const candidates = [card.code, card.cardId, card.collectionId ? `${card.collectionId}:${card.cardId}` : ''];
    if (candidates.includes(itemCode) || candidates.includes(itemCode.replace(/^.*:/, ''))) {
      return true;
    }
  }

  const itemName = safeString(item?.name || item?.playerName).toLowerCase();
  const itemTeam = safeString(item?.team || item?.teamName).toLowerCase();
  const itemNumber = safeString(item?.cardNumber || '');

  return itemName && itemTeam && (
    `${safeString(card.name).toLowerCase()}|${safeString(card.team).toLowerCase()}` === `${itemName}|${itemTeam}` &&
    (itemNumber === '' || safeString(card.cardNumber) === itemNumber)
  );
}

export function normalizeCollectionItem(item, fallbackList = catalogueCards) {
  if (!item) return null;

  const explicitCode = safeString(item.code || item.cardId || item.id);
  const matched = explicitCode ? getCatalogueItemByCode(explicitCode) : null;
  if (matched) {
    return {
      ...matched,
      owned: Boolean(item.owned),
      dupCount: Number(item.dupCount ?? (item.duplicate ? 1 : 0)),
      duplicate: Boolean(Number(item.dupCount ?? 0) > 0 || item.duplicate),
      wanted: Boolean(item.wanted),
      legacyCode: explicitCode !== matched.code && explicitCode !== matched.cardId ? explicitCode : null,
    };
  }

  const fallbackMatch = Array.isArray(fallbackList)
    ? fallbackList.find((card) => matchesCardByIdentity(card, item))
    : null;

  if (fallbackMatch) {
    return {
      ...fallbackMatch,
      owned: Boolean(item.owned),
      dupCount: Number(item.dupCount ?? (item.duplicate ? 1 : 0)),
      duplicate: Boolean(Number(item.dupCount ?? 0) > 0 || item.duplicate),
      wanted: Boolean(item.wanted),
      legacyCode: explicitCode || null,
    };
  }

  const collectionId = fallbackList?.[0]?.collectionId || catalogueMeta.id;
  const fallbackCode = explicitCode || deriveLegacyCode(item);
  return {
    code: fallbackCode,
    cardId: fallbackCode,
    collectionId,
    collectionTitle: catalogueMeta.title,
    name: safeString(item.name) || safeString(item.playerName) || 'Legacy card',
    team: safeString(item.team) || safeString(item.teamName) || 'Unknown team',
    sport: catalogueMeta.sport,
    manufacturer: catalogueMeta.manufacturer,
    setName: catalogueMeta.setName,
    season: catalogueMeta.season,
    league: catalogueMeta.league,
    cardNumber: safeString(item.cardNumber),
    cardType: safeString(item.cardType),
    variantName: safeString(item.variantName),
    owned: Boolean(item.owned),
    dupCount: Number(item.dupCount ?? (item.duplicate ? 1 : 0)),
    duplicate: Boolean(Number(item.dupCount ?? 0) > 0 || item.duplicate),
    wanted: Boolean(item.wanted),
    legacy: true,
    legacyCode: explicitCode || null,
  };
}
