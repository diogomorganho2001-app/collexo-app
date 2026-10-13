import React from 'react';

export default function MarketPage({ stickers }) {
  const trackedCards = (stickers || []).filter((card) => card.owned || card.wanted).slice(0, 12);

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
          {trackedCards.map((card) => (
            <div className="list-row" key={card.code || `${card.name}-${card.team}`}>
              <div>
                <strong>{card.name}</strong>
                <p>{card.team}</p>
              </div>
              <div className="list-detail">
                <span className="muted">Last updated: not available</span>
                <strong>Price unavailable</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
