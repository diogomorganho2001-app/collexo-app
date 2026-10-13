import React, { useMemo, useState } from 'react';
import { catalogueCards } from '../services/catalogue.js';

export default function ExploreCollectionsPage({ stickers, onToggleOwned }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const ownedByCode = useMemo(
    () => new Set((stickers || []).filter((card) => card.owned).map((card) => card.code)),
    [stickers],
  );

  const visibleCards = useMemo(() => {
    const query = search.trim().toLowerCase();

    return catalogueCards.filter((card) => {
      const matchesSearch = !query || [card.name, card.team, card.cardNumber, card.setName].join(' ').toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'owned' && ownedByCode.has(card.code)) ||
        (statusFilter === 'missing' && !ownedByCode.has(card.code));

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, ownedByCode]);

  return (
    <div className="page-shell">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">Explore</p>
          <h1>Collection catalogue</h1>
        </div>
        <div className="page-chip">{visibleCards.length} cards</div>
      </div>

      <div className="toolbar-card">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search player, team or card number"
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All cards</option>
          <option value="owned">Owned</option>
          <option value="missing">Missing</option>
        </select>
      </div>

      {visibleCards.length === 0 ? (
        <div className="empty-state">
          <h3>No cards match that search.</h3>
          <p>Try a different player name, team or card number.</p>
        </div>
      ) : (
        <div className="catalogue-grid">
          {visibleCards.map((card) => {
            const isOwned = ownedByCode.has(card.code);
            return (
              <article className="catalogue-card" key={card.code || `${card.name}-${card.cardNumber}`}>
                <div className="catalogue-card__top">
                  <span className="chip neutral">{card.setName}</span>
                  {isOwned && <span className="chip success">Owned</span>}
                </div>
                <h3>{card.name}</h3>
                <p>{card.team}</p>
                <dl className="meta-list">
                  <div><dt>Number</dt><dd>{card.cardNumber || 'N/A'}</dd></div>
                  <div><dt>Type</dt><dd>{card.cardType || 'Base'}</dd></div>
                  <div><dt>Season</dt><dd>{card.season || 'N/A'}</dd></div>
                </dl>
                <div className="card-footer">
                  <span className="muted">Price unavailable</span>
                  <button type="button" className="secondary-button" onClick={() => onToggleOwned(card.code)}>
                    {isOwned ? 'Remove from collection' : 'Add to collection'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
