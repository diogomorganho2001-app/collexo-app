import React, { useEffect, useState } from 'react';
import { fetchCardPrice, formatPriceAmount, getPriceStatusMeta } from '../services/pricing.js';

export default function WatchlistPage({ stickers, lists = [], onAddCardToList, onCreateList }) {
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
      await Promise.all(watchlist.map(async (card) => {
        const result = await fetchCardPrice(card);
        if (active) {
          next[card.code || `${card.name}-${card.team}`] = result;
        }
      }));
      if (active) {
        setPrices(next);
      }
    }

    loadPrices();
    return () => {
      active = false;
    };
  }, [watchlist]);

  const openListPicker = (card) => {
    const name = window.prompt('Name your new list', 'Cards to buy');
    if (name && typeof onCreateList === 'function') {
      const list = onCreateList(name, '');
      if (list && typeof onAddCardToList === 'function') {
        onAddCardToList(list.id, card.code);
      }
    }
  };

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
            const statusMeta = getPriceStatusMeta(priceResult);

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
                  <div className="market-row-actions">
                    <strong>{hasEstimate ? formatPriceAmount(priceResult.estimate, priceResult.currency) : statusMeta.label}</strong>
                    <button type="button" className="secondary-button small-button" onClick={() => openListPicker(card)}>
                      Add to list
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
