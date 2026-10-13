const PRICE_CACHE = new Map();
const PRICE_TTL_MS = 5 * 60 * 1000;
const PRICE_ENDPOINT = '/.netlify/functions/price';

function normalizeText(value = '') {
  return String(value ?? '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeCardNumber(value = '') {
  if (value === null || value === undefined) return '';
  return String(value).replace(/^#/, '').replace(/\s+/g, '').trim();
}

export function buildCardSearchTerms(card = {}) {
  return {
    name: card.name || card.playerName || '',
    team: card.team || card.teamName || '',
    manufacturer: card.manufacturer || '',
    setName: card.setName || card.collectionTitle || '',
    season: card.season || '',
    league: card.league || '',
    cardNumber: card.cardNumber || '',
    variantName: card.variantName || '',
    sport: card.sport || '',
    collectionId: card.collectionId || '',
  };
}

export function buildSalesQuery(card = {}) {
  const terms = buildCardSearchTerms(card);
  const parts = [
    terms.name,
    terms.team,
    terms.setName,
    terms.cardNumber ? `#${terms.cardNumber}` : '',
    terms.variantName,
  ].filter(Boolean);

  return parts.slice(0, 5).join(' ').trim() || 'soccer card';
}

export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export function scoreSaleMatch(card = {}, sale = {}) {
  if (!card || !sale) return 0;

  let score = 0;
  const cardName = normalizeText(card.name || card.playerName || '');
  const salePlayer = normalizeText(sale.player || sale.subject || '');
  const saleSet = normalizeText(sale.card_set || sale.set_name || '');
  const cardSet = normalizeText(card.setName || card.collectionTitle || '');
  const manufacturer = normalizeText(card.manufacturer || '');
  const saleManufacturer = normalizeText(sale.manufacturer || '');
  const cardNumber = normalizeCardNumber(card.cardNumber || '');
  const saleNumber = normalizeCardNumber(sale.card_number || '');
  const variantName = normalizeText(card.variantName || '');
  const saleTitle = normalizeText(sale.title || '');

  if (sale.price !== null && sale.price !== undefined && Number.isFinite(Number(sale.price))) {
    score += 10;
  }

  if (cardName && salePlayer) {
    if (cardName === salePlayer) score += 30;
    else if (salePlayer.includes(cardName) || cardName.includes(salePlayer)) score += 18;
  }

  if (cardSet && saleSet) {
    if (cardSet === saleSet) score += 28;
    else if (saleSet.includes(cardSet) || cardSet.includes(saleSet)) score += 16;
  }

  if (manufacturer && saleManufacturer) {
    if (manufacturer === saleManufacturer) score += 12;
    else if (saleManufacturer.includes(manufacturer) || manufacturer.includes(saleManufacturer)) score += 6;
  }

  if (cardNumber && saleNumber) {
    if (cardNumber === saleNumber) score += 24;
    else if (cardNumber === saleNumber.replace(/^0+/, '')) score += 18;
  }

  if (variantName && saleTitle) {
    if (saleTitle.includes(variantName) || variantName.includes(saleTitle)) score += 10;
  }

  if (card.team && sale.team) {
    const cardTeam = normalizeText(card.team);
    const saleTeam = normalizeText(sale.team);
    if (cardTeam && cardTeam === saleTeam) score += 8;
    else if (cardTeam && (saleTeam.includes(cardTeam) || cardTeam.includes(saleTeam))) score += 4;
  }

  return score;
}

export function filterComparableSales(card, sales = []) {
  if (!Array.isArray(sales)) return [];

  return sales
    .map((sale) => ({ ...sale, matchScore: scoreSaleMatch(card, sale) }))
    .filter((sale) => Number.isFinite(Number(sale.price)) && sale.matchScore >= 50)
    .sort((left, right) => (right.matchScore || 0) - (left.matchScore || 0))
    .slice(0, 10);
}

export function buildPriceResult(card = {}, sales = [], meta = {}) {
  const comparableSales = filterComparableSales(card, sales);
  if (!comparableSales.length) {
    return {
      status: 'unavailable',
      reason: 'insufficient_data',
      message: 'No sufficiently comparable sales were found for this card.',
      source: 'The Card API',
      sourceUrl: 'https://www.thecardapi.com',
      lastFetchedAt: new Date().toISOString(),
      currency: 'USD',
      coverage: meta.coverage_date_from && meta.coverage_date_to ? `${meta.coverage_date_from} to ${meta.coverage_date_to}` : 'Recent completed sales',
      confidence: 'low',
      sampleSize: 0,
      comparableSales: [],
    };
  }

  const prices = comparableSales.map((sale) => Number(sale.price)).filter(Number.isFinite);
  const estimate = median(prices);
  const average = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const max = Math.max(...prices);
  const min = Math.min(...prices);
  const currency = comparableSales[0]?.currency || 'USD';
  const matchConfidence = comparableSales.some((sale) => sale.matchScore >= 80) ? 'high' : 'medium';

  return {
    status: 'available',
    estimate: Number(estimate.toFixed(2)),
    median: Number(median(prices).toFixed(2)),
    average: Number(average.toFixed(2)),
    low: Number(min.toFixed(2)),
    high: Number(max.toFixed(2)),
    currency,
    sampleSize: prices.length,
    source: 'The Card API',
    sourceUrl: 'https://www.thecardapi.com',
    lastFetchedAt: new Date().toISOString(),
    coverage: meta.coverage_date_from && meta.coverage_date_to ? `${meta.coverage_date_from} to ${meta.coverage_date_to}` : 'Recent completed sales',
    confidence: matchConfidence,
    comparableSales: comparableSales.map((sale) => ({
      id: sale.id || sale.title || `${sale.sale_date}-${sale.price}`,
      price: Number(sale.price),
      currency: sale.currency || currency,
      saleDate: sale.sale_date || sale.sold_at || null,
      listingUrl: sale.listing_url || null,
      title: sale.title || sale.player || card.name || 'Card sale',
      platform: sale.platform || null,
    })),
  };
}

export function formatPriceAmount(value, currency = 'USD') {
  if (!Number.isFinite(Number(value))) return 'Price unavailable';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${currency || 'USD'} ${Number(value).toFixed(2)}`;
  }
}

export async function fetchCardPrice(card, options = {}) {
  if (!card) {
    return {
      status: 'unavailable',
      reason: 'missing_card',
      message: 'No card data was supplied.',
      source: 'The Card API',
      currency: 'USD',
      lastFetchedAt: new Date().toISOString(),
      comparableSales: [],
    };
  }

  const key = card.code || card.cardId || `${card.collectionId || 'unknown'}:${card.name || card.playerName || 'card'}`;
  const cached = PRICE_CACHE.get(key);
  if (cached && Date.now() - cached.fetchedAt < PRICE_TTL_MS) {
    return cached.result;
  }

  try {
    const query = new URLSearchParams({
      name: card.name || card.playerName || '',
      team: card.team || card.teamName || '',
      manufacturer: card.manufacturer || '',
      setName: card.setName || card.collectionTitle || '',
      season: card.season || '',
      league: card.league || '',
      cardNumber: card.cardNumber || '',
      variantName: card.variantName || '',
      sport: card.sport || '',
    });

    const response = await fetch(`${PRICE_ENDPOINT}?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });

    const payload = await response.json();
    if (!response.ok || payload?.status === 'unavailable' || payload?.error) {
      const result = payload && typeof payload === 'object' ? payload : {
        status: 'unavailable',
        reason: 'upstream_error',
        message: 'Price service did not return usable data.',
      };
      PRICE_CACHE.set(key, { fetchedAt: Date.now(), result });
      return result;
    }

    PRICE_CACHE.set(key, { fetchedAt: Date.now(), result: payload });
    return payload;
  } catch (error) {
    const result = {
      status: 'unavailable',
      reason: 'request_failed',
      message: error?.message || 'Price lookup failed.',
      source: 'The Card API',
      currency: 'USD',
      lastFetchedAt: new Date().toISOString(),
      comparableSales: [],
    };
    PRICE_CACHE.set(key, { fetchedAt: Date.now(), result });
    return result;
  }
}

export function clearPricingCache() {
  PRICE_CACHE.clear();
}
