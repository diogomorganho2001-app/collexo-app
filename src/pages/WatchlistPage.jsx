import React, { useEffect, useState } from 'react';
import { fetchCardPrice, formatPriceAmount } from '../services/pricing.js';

export default function WatchlistPage({ stickers }) {
  const watchlist = (stickers || []).filter((card) => card.wanted);
  const [prices, setPrices] = useState({});

  useEffect(() => {
    if (!watchlist.length) {
      setPrices({});
      return;
    }

    let active = true;
    async function loadPrices() {
      const next = {};
      for (const card of watchlist) {
        const result = await fetchCardPrice(card);
        if (active) {
          next[card.code || `${card.name}-${card.team}`] = result;
        }
      }
      if (active) {
        setPrices(next);
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
          <p className="eyebrow">Watchlist</p>
          <h1>My Watchlist</h1>
        </div>
        <div className="page-chip">{watchlist.length} cards</div>
      </div>

      {watchlist.length === 0 ? (
        <div className="empty-state">
          <h3>Your watchlist is empty.</h3>
          <p>Mark cards as wanted in your collection to follow them here.</p>
        </div>
      ) : (
        <div className="stacked-list">
          {watchlist.map((card) => {
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
                    {priceResult?.lastFetchedAt ? `Last updated: ${new Date(priceResult.lastFetchedAt).toLocaleDateString()}` : 'Checking market data…'}
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
