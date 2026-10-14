import React, { useEffect, useMemo, useState } from 'react';
import { fetchCardPrice, formatPriceAmount, getPriceStatusMeta } from '../services/pricing.js';

export default function MarketPage({ stickers, lists = [], onAddCardToList, onCreateList }) {
  const [marketFilter, setMarketFilter] = useState('all');
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);

  const trackedCards = useMemo(() => {
    const cards = (stickers || []).filter((card) => card.owned || card.wanted);
    if (marketFilter === 'owned') return cards.filter((card) => card.owned);
    if (marketFilter === 'wanted') return cards.filter((card) => card.wanted);
    if (marketFilter === 'owned_and_wanted') return cards.filter((card) => card.owned && card.wanted);
    return cards;
  }, [marketFilter, stickers]);

  useEffect(() => {
    if (!trackedCards.length) {
      setPrices({});
      return;
    }

    let active = true;
    async function loadPrices() {
      setLoading(true);
      const next = {};
      await Promise.all(trackedCards.map(async (card) => {
        const result = await fetchCardPrice(card);
        if (active) {
          next[card.code || `${card.name}-${card.team}`] = result;
        }
      }));
      if (active) {
        setPrices(next);
        setLoading(false);
      }
    }

    loadPrices();
    return () => {
      active = false;
    };
  }, [trackedCards]);

  const openListPicker = (card, event) => {
    event.preventDefault();
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
          <p className="eyebrow">Market</p>
          <h1>My Market</h1>
        </div>
        <div className="page-chip">{trackedCards.length} relevant cards</div>
      </div>

      <div className="toolbar-card detail-toolbar">
        <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)}>
          <option value="all">All Market Cards</option>
          <option value="owned">Owned</option>
          <option value="wanted">Wish List</option>
          <option value="owned_and_wanted">Owned &amp; Wish Listed</option>
        </select>
      </div>

      {trackedCards.length === 0 ? (
        <div className="empty-state">
          <h3>No relevant market cards yet.</h3>
          <p>Add cards to your collection or watchlist to track them here. Market only shows cards you own or want.</p>
        </div>
      ) : (
        <div className="stacked-list">
          {trackedCards.map((card) => {
            const key = card.code || `${card.name}-${card.team}`;
            const priceResult = prices[key];
            const statusMeta = getPriceStatusMeta(priceResult);
            const hasEstimate = priceResult?.status === 'available' && Number.isFinite(Number(priceResult.estimate));
            const displayValue = hasEstimate
              ? formatPriceAmount(priceResult.estimate, priceResult.currency)
              : statusMeta.label;

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
                  <div className="market-row-actions">
                    <strong>{displayValue}</strong>
                    <button type="button" className="secondary-button small-button" onClick={(event) => openListPicker(card, event)}>
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
