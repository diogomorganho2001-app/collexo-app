const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function normalizeStatus(reason) {
  switch (reason) {
    case 'missing_api_key':
      return 'not_configured';
    case 'invalid_key':
      return 'provider_error';
    case 'rate_limited':
      return 'rate_limited';
    case 'timeout':
    case 'request_failed':
    case 'upstream_error':
      return 'provider_error';
    case 'insufficient_data':
      return 'insufficient_data';
    case 'no_match':
      return 'no_match';
    default:
      return 'unavailable';
  }
}

function buildSearchQuery(params = {}) {
  const parts = [
    params.name,
    params.playerName,
    params.team,
    params.teamName,
    params.setName,
    params.collectionTitle,
    params.cardNumber ? `#${params.cardNumber}` : '',
    params.variantName,
    params.manufacturer,
  ].filter(Boolean);

  const trimmed = parts
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  if (trimmed) return trimmed;

  const fallback = [params.sport, params.league, 'sports card'].filter(Boolean).join(' ');
  return fallback || 'soccer card';
}

function buildUnavailableResponse(reason, message, extra = {}) {
  return {
    statusCode: 200,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({
      status: normalizeStatus(reason),
      reason,
      message,
      source: 'The Card API',
      sourceUrl: 'https://www.thecardapi.com',
      currency: 'USD',
      lastFetchedAt: new Date().toISOString(),
      comparableSales: [],
      ...extra,
    }),
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: '',
    };
  }

  const params = event.queryStringParameters || {};
  const apiKey = process.env.THECARDAPI_KEY || process.env.THE_CARD_API_KEY || process.env.NETLIFY_THECARDAPI_KEY;

  if (!apiKey) {
    return buildUnavailableResponse(
      'missing_api_key',
      'The Card API key is not configured for this deployment. Add THECARDAPI_KEY in Netlify environment settings.'
    );
  }

  const q = buildSearchQuery(params);
  const url = new URL('https://thecardapi.com/api/v1/market/sales');
  url.searchParams.set('q', q);
  url.searchParams.set('limit', '5');
  url.searchParams.set('sort', 'date_desc');
  url.searchParams.set('category', 'sports');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-market-api-key': apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const reason = response.status === 429 ? 'rate_limited' : response.status === 401 || response.status === 403 ? 'invalid_key' : 'upstream_error';
      return buildUnavailableResponse(
        reason,
        payload?.error || payload?.message || `The Card API responded with HTTP ${response.status}.`,
        { statusCode: response.status }
      );
    }

    const sales = Array.isArray(payload?.data) ? payload.data : [];
    if (!sales.length) {
      return buildUnavailableResponse(
        'insufficient_data',
        'No recent marketplace sales matched this card closely enough to produce a value estimate.'
      );
    }

    const comparableSales = sales
      .filter((sale) => Number.isFinite(Number(sale?.price)))
      .filter((sale) => !!(sale?.title || sale?.player || sale?.card_set || sale?.set_name))
      .map((sale) => ({ ...sale, price: Number(sale.price), score: 0 }))
      .slice(0, 10);

    if (!comparableSales.length) {
      return buildUnavailableResponse(
        'no_match',
        'No matching card found for the provided card details.'
      );
    }

    const prices = comparableSales.map((sale) => Number(sale.price));
    const estimate = Number(median(prices).toFixed(2));
    const average = Number((prices.reduce((sum, value) => sum + value, 0) / prices.length).toFixed(2));
    const max = Number(Math.max(...prices).toFixed(2));
    const min = Number(Math.min(...prices).toFixed(2));
    const currency = comparableSales[0]?.currency || 'USD';

    return {
      statusCode: 200,
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        status: 'available',
        estimate,
        median: estimate,
        average,
        low: min,
        high: max,
        currency,
        sampleSize: prices.length,
        source: 'The Card API',
        sourceUrl: 'https://www.thecardapi.com',
        lastFetchedAt: new Date().toISOString(),
        coverage: payload?.meta?.coverage_date_from && payload?.meta?.coverage_date_to
          ? `${payload.meta.coverage_date_from} to ${payload.meta.coverage_date_to}`
          : 'Recent completed sales',
        comparableSales: comparableSales.map((sale) => ({
          id: sale.id || sale.title || `${sale.sale_date}-${sale.price}`,
          price: Number(sale.price),
          currency: sale.currency || currency,
          saleDate: sale.sale_date || sale.sold_at || null,
          listingUrl: sale.listing_url || null,
          title: sale.title || sale.player || 'Card sale',
          platform: sale.platform || null,
        })),
      }),
    };
  } catch (error) {
    const reason = error?.name === 'AbortError' ? 'timeout' : 'request_failed';
    return buildUnavailableResponse(
      reason,
      error?.message || 'A timeout occurred while fetching market values.'
    );
  } finally {
    clearTimeout(timeout);
  }
};

export default handler;
