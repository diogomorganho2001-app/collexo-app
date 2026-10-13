import React, { useEffect, useState } from 'react';
import { fetchCardPrice, formatPriceAmount } from '../services/pricing.js';

export default function MarketPage({ stickers }) {
  const trackedCards = (stickers || []).filter((card) => card.owned || card.wanted).slice(0, 12);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trackedCards.length) {
      setPrices({});
      return;
    }

    let active = true;
    async function loadPrices() {
      setLoading(true);
      const next = {};
      for (const card of trackedCards) {
        const result = await fetchCardPrice(card);
        if (active) {
          next[card.code || `${card.name}-${card.team}`] = result;
        }
      }
      if (active) {
        setPrices(next);
        setLoading(false);
      }
    }

    loadPrices();
    return () => {
      active = false;
    };
  }, [stickers]);

  return (
    <div className="page-shell">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">Market</p>
          <h1>Market overview</h1>
        </div>
        <div className="page-chip">Track card value</div>
      </div>

      {trackedCards.length === 0 ? (
        <div className="empty-state">
          <h3>Price data is not available yet.</h3>
          <p>Add cards to your collection or watchlist to start tracking price signals when a source is connected.</p>
        </div>
      ) : (
        <div className="stacked-list">
          {trackedCards.map((card) => {
            const key = card.code || `${card.name}-${card.team}`;
            const priceResult = prices[key];
            const hasEstimate = priceResult?.status === 'available' && Number.isFinite(Number(priceResult.estimate));

            return (
              <div className="list-row" key={key}>
                <div>
                  <strong>{card.name}</strong>
                  <p>{card.team}</p>
                </div>
                <div className="list-detail">
                  <span className="muted">
                    {priceResult?.lastFetchedAt ? `Last updated: ${new Date(priceResult.lastFetchedAt).toLocaleDateString()}` : loading ? 'Checking market data…' : 'Last updated: not available'}
                  </span>
                  <strong>
                    {hasEstimate ? formatPriceAmount(priceResult.estimate, priceResult.currency) : 'Price unavailable'}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
