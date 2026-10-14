import React, { useEffect, useMemo, useState } from 'react';
import { fetchCardPrice, formatPriceAmount, getPriceStatusMeta } from '../services/pricing.js';

function getCopiesOwned(card) {
  if (!card || !card.owned) return 0;
  return Math.max(1, (Number(card.dupCount) || 0) + 1);
}

function buildHistorySeries(ownedCards = [], results = {}) {
  const totalsByDate = new Map();

  ownedCards.forEach((card) => {
    const priceResult = results[card.code];
    const sales = Array.isArray(priceResult?.comparableSales) ? priceResult.comparableSales : [];
    const copies = getCopiesOwned(card);

    if (sales.length) {
      sales.forEach((sale) => {
        const date = sale.saleDate ? new Date(sale.saleDate) : null;
        if (!date || Number.isNaN(date.getTime())) return;
        const key = date.toISOString().slice(0, 10);
        const value = Number(sale.price || 0) * copies;
        totalsByDate.set(key, (totalsByDate.get(key) || 0) + value);
      });
    }

    if (priceResult?.status === 'available' && Number.isFinite(Number(priceResult.estimate))) {
      const today = new Date();
      const key = today.toISOString().slice(0, 10);
      totalsByDate.set(key, (totalsByDate.get(key) || 0) + Number(priceResult.estimate) * copies);
    }
  });

  return Array.from(totalsByDate.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function buildLinePath(points) {
  if (!points.length) return '';
  const minValue = Math.min(...points.map((point) => point.total));
  const maxValue = Math.max(...points.map((point) => point.total));
  const width = 600;
  const height = 210;
  const padding = 18;
  const range = maxValue - minValue || 1;

  return points.map((point, index) => {
    const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.total - minValue) / range) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
}

export default function PortfolioPage({ stickers = [] }) {
  const [selectedRange, setSelectedRange] = useState(30);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);

  const ownedCards = useMemo(() => (stickers || []).filter((card) => card.owned), [stickers]);

  useEffect(() => {
    if (!ownedCards.length) {
      setPrices({});
      return;
    }

    let active = true;
    async function load() {
      setLoading(true);
      const next = {};
      await Promise.all(ownedCards.map(async (card) => {
        const result = await fetchCardPrice(card);
        if (active) {
          next[card.code] = result;
        }
      }));
      if (active) {
        setPrices(next);
        setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [ownedCards]);

  const portfolioValue = useMemo(() => {
    return ownedCards.reduce((sum, card) => {
      const priceResult = prices[card.code];
      const estimate = Number(priceResult?.estimate || 0);
      if (!priceResult || priceResult.status !== 'available' || !Number.isFinite(estimate)) {
        return sum;
      }
      return sum + estimate * getCopiesOwned(card);
    }, 0);
  }, [ownedCards, prices]);

  const unpricedCount = ownedCards.filter((card) => {
    const priceResult = prices[card.code];
    return !priceResult || priceResult.status !== 'available' || !Number.isFinite(Number(priceResult.estimate));
  }).length;

  const chartSeries = useMemo(() => buildHistorySeries(ownedCards, prices), [ownedCards, prices]);
  const filteredHistory = useMemo(() => {
    if (!chartSeries.length) return [];
    if (selectedRange === 'all') return chartSeries;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(selectedRange));
    return chartSeries.filter((point) => new Date(point.date) >= cutoff);
  }, [chartSeries, selectedRange]);

  const chartPath = useMemo(() => buildLinePath(filteredHistory), [filteredHistory]);
  const latestValue = filteredHistory.length ? filteredHistory[filteredHistory.length - 1].total : portfolioValue;
  const previousValue = filteredHistory.length > 1 ? filteredHistory[filteredHistory.length - 2].total : null;
  const delta = previousValue !== null ? latestValue - previousValue : 0;

  const gainers = useMemo(() => {
    return ownedCards
      .map((card) => {
        const result = prices[card.code];
        if (!result || result.status !== 'available' || !Number.isFinite(Number(result.estimate))) return null;
        const current = Number(result.estimate) * getCopiesOwned(card);
        const historical = Array.isArray(result.comparableSales) && result.comparableSales.length
          ? Number(result.comparableSales[0].price || 0) * getCopiesOwned(card)
          : current;
        return { name: card.name, delta: current - historical };
      })
      .filter(Boolean)
      .sort((left, right) => right.delta - left.delta)
      .slice(0, 3);
  }, [ownedCards, prices]);

  const losers = useMemo(() => {
    return [...gainers].sort((left, right) => left.delta - right.delta).slice(0, 3);
  }, [gainers]);

  return (
    <div className="page-shell">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1>Portfolio overview</h1>
        </div>
        <div className="page-chip">USD market estimate</div>
      </div>

      {ownedCards.length === 0 ? (
        <div className="empty-state">
          <h3>No owned cards to value yet.</h3>
          <p>Mark cards as owned in your collection to build a portfolio and price history.</p>
        </div>
      ) : (
        <>
          <div className="summary-grid portfolio-grid">
            <div className="metric-card highlight-metric">
              <span>Total estimated value</span>
              <strong>{formatPriceAmount(portfolioValue, 'USD')}</strong>
              <small>Estimated market value only; not a guaranteed resale value.</small>
            </div>
            <div className="metric-card">
              <span>Cards included</span>
              <strong>{ownedCards.filter((card) => prices[card.code]?.status === 'available').length}</strong>
            </div>
            <div className="metric-card">
              <span>Cards unpriced</span>
              <strong>{unpricedCount}</strong>
            </div>
            <div className="metric-card">
              <span>Last updated</span>
              <strong>{loading ? 'Loading…' : 'Live'}</strong>
            </div>
          </div>

          <div className="toolbar-card detail-toolbar">
            <div className="range-toggle">
              {[7, 30, 90, 'all'].map((range) => (
                <button
                  key={String(range)}
                  type="button"
                  className={selectedRange === range ? 'secondary-button small-button active-range' : 'secondary-button small-button'}
                  onClick={() => setSelectedRange(range)}
                >
                  {range === 'all' ? 'All' : `${range}d`}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-shell">
            {filteredHistory.length < 2 ? (
              <div className="empty-state compact-empty">
                <h3>More history is needed.</h3>
                <p>Only one dated observation is available for your portfolio right now. The current value is shown below, but a longer history is required to draw a meaningful trend.</p>
              </div>
            ) : (
              <>
                <svg viewBox="0 0 600 210" role="img" aria-label="Portfolio value over time chart" className="portfolio-chart">
                  <path d={chartPath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
                  {filteredHistory.map((point, index) => {
                    const x = 18 + (index / Math.max(1, filteredHistory.length - 1)) * 564;
                    const yValue = Math.min(...filteredHistory.map((entry) => entry.total));
                    const yMax = Math.max(...filteredHistory.map((entry) => entry.total));
                    const y = 210 - 18 - ((point.total - yValue) / Math.max(1, yMax - yValue)) * 174;
                    return <circle key={point.date} cx={x} cy={y} r="3.5" fill="var(--accent)" />;
                  })}
                </svg>
                <div className="chart-legend">
                  <span>Selected point: {filteredHistory[filteredHistory.length - 1].date}</span>
                  <strong>{formatPriceAmount(filteredHistory[filteredHistory.length - 1].total, 'USD')}</strong>
                </div>
              </>
            )}
          </div>

          <div className="summary-grid portfolio-grid small-grid">
            <div className="metric-card">
              <span>Portfolio change</span>
              <strong>{formatPriceAmount(delta, 'USD')}</strong>
            </div>
            <div className="metric-card">
              <span>Top gainers</span>
              <strong>{gainers.length ? `${gainers[0].name}` : 'Not enough data'}</strong>
            </div>
            <div className="metric-card">
              <span>Top losers</span>
              <strong>{losers.length ? `${losers[0].name}` : 'Not enough data'}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
