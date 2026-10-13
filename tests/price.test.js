import test from 'node:test';
import assert from 'node:assert/strict';

import { handler } from '../netlify/functions/price.js';
import { buildPriceResult, clearPricingCache, fetchCardPrice, filterComparableSales, formatPriceAmount } from '../src/services/pricing.js';

const originalEnv = { ...process.env };

function mockFetchOnce(payload, options = {}) {
  const fetchMock = async () => ({
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => payload,
  });
  return fetchMock;
}

test.afterEach(() => {
  process.env = { ...originalEnv };
  clearPricingCache();
  global.fetch = undefined;
});

test('market proxy returns unavailable when API key is missing', async () => {
  delete process.env.THECARDAPI_KEY;
  delete process.env.THE_CARD_API_KEY;
  delete process.env.NETLIFY_THECARDAPI_KEY;

  const response = await handler({ httpMethod: 'GET', queryStringParameters: { name: 'Kylian Mbappé' } });
  const body = JSON.parse(response.body);

  assert.equal(body.status, 'unavailable');
  assert.equal(body.reason, 'missing_api_key');
});

test('market proxy converts rate-limit errors into a specific unavailable reason', async () => {
  process.env.THECARDAPI_KEY = 'demo-key';
  global.fetch = mockFetchOnce({ error: 'rate_limited' }, { ok: false, status: 429 });

  const response = await handler({ httpMethod: 'GET', queryStringParameters: { name: 'Cristiano Ronaldo' } });
  const body = JSON.parse(response.body);

  assert.equal(body.status, 'unavailable');
  assert.equal(body.reason, 'rate_limited');
});

test('market proxy returns an estimate when sales data is valid', async () => {
  process.env.THECARDAPI_KEY = 'demo-key';
  global.fetch = mockFetchOnce({
    data: [
      { price: 120, currency: 'USD', title: '2024 Topps Mbappé', sale_date: '2025-01-01' },
      { price: 140, currency: 'USD', title: '2024 Topps Mbappé', sale_date: '2025-01-05' },
      { price: 160, currency: 'USD', title: '2024 Topps Mbappé', sale_date: '2025-01-09' },
    ],
    meta: { coverage_date_from: '2025-01-01', coverage_date_to: '2025-01-10' },
  });

  const response = await handler({ httpMethod: 'GET', queryStringParameters: { name: 'Kylian Mbappé', team: 'Real Madrid' } });
  const body = JSON.parse(response.body);

  assert.equal(body.status, 'available');
  assert.equal(body.estimate, 140);
  assert.equal(body.currency, 'USD');
  assert.equal(body.comparableSales.length, 3);
});

test('pricing helper resolves comparable sales by score and formats EUR price values', () => {
  const sales = [
    { price: 100, title: '2024 Topps Mbappé', player: 'Kylian Mbappe', card_set: '2024 Topps' },
    { price: 50, title: '2024 Topps Ronaldo', player: 'Cristiano Ronaldo', card_set: '2024 Topps' },
  ];

  const card = {
    name: 'Kylian Mbappe',
    setName: '2024 Topps',
    manufacturer: 'Topps',
    team: 'Real Madrid',
    cardNumber: '10',
  };

  const filtered = filterComparableSales(card, sales);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].price, 100);
  assert.equal(formatPriceAmount(123.45, 'EUR'), '€123.45');
});

test('fetchCardPrice reuses cache entries and surfaces request failures cleanly', async () => {
  const card = { code: 'TEST1', name: 'Kylian Mbappé', team: 'Real Madrid', setName: '2024 Topps' };
  let calls = 0;

  global.fetch = async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        status: 'available',
        estimate: 99.99,
        currency: 'USD',
      }),
    };
  };

  const first = await fetchCardPrice(card);
  const second = await fetchCardPrice(card);

  assert.equal(first.status, 'available');
  assert.equal(second.status, 'available');
  assert.equal(calls, 1);

  const failedFetch = async () => {
    throw new Error('Request timed out');
  };

  global.fetch = failedFetch;
  const failure = await fetchCardPrice({ ...card, code: 'TEST2' });
  assert.equal(failure.status, 'unavailable');
  assert.equal(failure.reason, 'request_failed');
});

test('buildPriceResult returns insufficient data when comparable sales are not close enough', () => {
  const result = buildPriceResult(
    { name: 'Kylian Mbappe', setName: '2024 Topps', manufacturer: 'Topps' },
    [{ price: 20, player: 'Someone Else', card_set: 'Other Set' }],
    { coverage_date_from: '2025-01-01', coverage_date_to: '2025-01-10' }
  );

  assert.equal(result.status, 'unavailable');
  assert.equal(result.reason, 'insufficient_data');
});
