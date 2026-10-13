import React from 'react';

export default function WatchlistPage({ stickers }) {
  const watchlist = (stickers || []).filter((card) => card.wanted);

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
          {watchlist.map((card) => (
            <div className="list-row" key={card.code || `${card.name}-${card.team}`}>
              <div>
                <strong>{card.name}</strong>
                <p>{card.team}</p>
              </div>
              <div className="list-detail">
                <span className="muted">Price source unavailable</span>
                <strong>Price unavailable</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
