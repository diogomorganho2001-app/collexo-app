import catalogueJson from '../../data/sports/football/topps-ucc-2025-26.json';

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

export const catalogueMeta = {
  id: catalogueJson?.set?.setId || 'catalogue',
  name: catalogueJson?.set?.name || 'Sports Card Catalogue',
  sport: catalogueJson?.set?.sport || 'football',
  manufacturer: catalogueJson?.source?.manufacturer || 'Unknown manufacturer',
  setName: catalogueJson?.set?.name || 'Collection',
  season: catalogueJson?.set?.season || catalogueJson?.source?.season || '',
  league: catalogueJson?.set?.league || '',
};

export const catalogueCards = Array.isArray(catalogueJson?.cards)
  ? catalogueJson.cards.map((card, index) => {
      const cardId = safeString(card?.cardId) || `${catalogueMeta.setName}-${safeString(card?.cardNumber) || index + 1}`;
      return {
        code: cardId,
        cardId,
        name: safeString(card?.playerName) || safeString(card?.name) || `Card ${safeString(card?.cardNumber) || index + 1}`,
        team: safeString(card?.teamName) || safeString(card?.team) || 'Unknown team',
        cardNumber: safeString(card?.cardNumber),
        cardType: safeString(card?.cardType),
        variantName: safeString(card?.variantName),
        sport: catalogueMeta.sport,
        manufacturer: catalogueMeta.manufacturer,
        setName: catalogueMeta.setName,
        season: catalogueMeta.season,
        league: catalogueMeta.league,
        sourcePage: card?.sourcePage ?? null,
        owned: false,
        dupCount: 0,
        duplicate: false,
        wanted: false,
      };
    })
  : [];

export function getCatalogueItemByCode(code) {
  return catalogueCards.find(item => item.code === code || item.cardId === code) || null;
}

export function deriveLegacyCode(item = {}) {
  const source = item.code || item.cardId || item.name || item.team || 'legacy-card';
  return `legacy-${slugify(source)}`;
}

export function normalizeCollectionItem(item, fallbackList = catalogueCards) {
  if (!item) return null;

  const explicitCode = safeString(item.code || item.cardId);
  const matched = explicitCode ? getCatalogueItemByCode(explicitCode) : null;
  if (matched) {
    return {
      ...matched,
      owned: Boolean(item.owned),
      dupCount: Number(item.dupCount ?? (item.duplicate ? 1 : 0)),
      duplicate: Boolean(Number(item.dupCount ?? 0) > 0 || item.duplicate),
      wanted: Boolean(item.wanted),
      legacyCode: explicitCode !== matched.code ? explicitCode : null,
    };
  }

  const key = `${safeString(item.name).trim().toLowerCase()}|${safeString(item.team).trim().toLowerCase()}`;
  const fallbackMatch = fallbackList.find(card => {
    const cardKey = `${safeString(card.name).trim().toLowerCase()}|${safeString(card.team).trim().toLowerCase()}`;
    return cardKey === key;
  });

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

  const fallbackCode = explicitCode || deriveLegacyCode(item);
  return {
    code: fallbackCode,
    cardId: fallbackCode,
    name: safeString(item.name) || safeString(item.playerName) || 'Legacy card',
    team: safeString(item.team) || safeString(item.teamName) || 'Unknown team',
    sport: catalogueMeta.sport,
    manufacturer: catalogueMeta.manufacturer,
    setName: catalogueMeta.setName,
    season: catalogueMeta.season,
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
