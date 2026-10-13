import React, { useMemo, useState } from 'react';
import {
  catalogueCollections,
  getCollectionById,
  getCollectionCards,
} from '../services/catalogue.js';

function getInitials(value = '') {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'C';
}

function toPercent(owned, total) {
  if (!total) return 0;
  return Math.round((owned / total) * 100);
}

function compareCardNumbers(left, right) {
  const leftNumber = Number.parseInt(String(left || '').match(/\d+/)?.[0] || '999999', 10);
  const rightNumber = Number.parseInt(String(right || '').match(/\d+/)?.[0] || '999999', 10);
  return leftNumber - rightNumber;
}

function filterCollections(collections, search, filters) {
  const query = search.trim().toLowerCase();

  return collections.filter((collection) => {
    const haystack = [
      collection.title,
      collection.manufacturer,
      collection.sport,
      collection.season,
      collection.league,
      collection.collectionType,
    ].join(' ').toLowerCase();

    const matchesSearch = !query || haystack.includes(query);
    const matchesSport = filters.sport === 'all' || collection.sport === filters.sport;
    const matchesManufacturer = filters.manufacturer === 'all' || collection.manufacturer === filters.manufacturer;
    const matchesSeason = filters.season === 'all' || collection.season === filters.season;
    const matchesLeague = filters.league === 'all' || collection.league === filters.league;
    const matchesType = filters.type === 'all' || collection.collectionType === filters.type;

    return matchesSearch && matchesSport && matchesManufacturer && matchesSeason && matchesLeague && matchesType;
  });
}

export default function ExploreCollectionsPage({
  stickers,
  onToggleOwned,
  selectedCollectionId,
  onSelectCollection,
  onBackToCollections,
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    sport: 'all',
    manufacturer: 'all',
    season: 'all',
    league: 'all',
    type: 'all',
  });
  const [detailSearch, setDetailSearch] = useState('');
  const [detailStatus, setDetailStatus] = useState('all');
  const [detailCardType, setDetailCardType] = useState('all');
  const [sortMode, setSortMode] = useState('number');

  const collectionStats = useMemo(() => {
    const stats = new Map();

    catalogueCollections.forEach((collection) => {
      const cards = getCollectionCards(collection.id);
      const ownedCodes = new Set(
        (stickers || [])
          .filter((card) => card.collectionId === collection.id && card.owned)
          .map((card) => card.code),
      );
      const ownedCount = cards.filter((card) => ownedCodes.has(card.code)).length;

      stats.set(collection.id, {
        ownedCount,
        missingCount: cards.length - ownedCount,
        percent: toPercent(ownedCount, cards.length),
      });
    });

    return stats;
  }, [stickers]);

  const sportOptions = useMemo(
    () => ['all', ...new Set(catalogueCollections.map((collection) => collection.sport).filter(Boolean))],
    [],
  );
  const manufacturerOptions = useMemo(
    () => ['all', ...new Set(catalogueCollections.map((collection) => collection.manufacturer).filter(Boolean))],
    [],
  );
  const seasonOptions = useMemo(
    () => ['all', ...new Set(catalogueCollections.map((collection) => collection.season).filter(Boolean))],
    [],
  );
  const leagueOptions = useMemo(
    () => ['all', ...new Set(catalogueCollections.map((collection) => collection.league).filter(Boolean))],
    [],
  );
  const typeOptions = useMemo(
    () => ['all', ...new Set(catalogueCollections.map((collection) => collection.collectionType).filter(Boolean))],
    [],
  );

  const filteredCollections = useMemo(
    () => filterCollections(catalogueCollections, search, filters),
    [search, filters],
  );

  const selectedCollection = useMemo(
    () => (selectedCollectionId ? getCollectionById(selectedCollectionId) : null),
    [selectedCollectionId],
  );

  const selectedCollectionCards = useMemo(() => {
    if (!selectedCollection) return [];
    return getCollectionCards(selectedCollection.id);
  }, [selectedCollection]);

  const cardTypeOptions = useMemo(
    () => ['all', ...new Set(selectedCollectionCards.map((card) => card.cardType).filter(Boolean))],
    [selectedCollectionCards],
  );

  const visibleSelectedCards = useMemo(() => {
    const query = detailSearch.trim().toLowerCase();

    const filtered = selectedCollectionCards.filter((card) => {
      const haystack = [card.name, card.team, card.cardNumber, card.variantName, card.cardType].join(' ').toLowerCase();
      const statusMatch =
        detailStatus === 'all' ||
        (detailStatus === 'owned' && (stickers || []).some((item) => item.code === card.code && item.owned)) ||
        (detailStatus === 'missing' && !(stickers || []).some((item) => item.code === card.code && item.owned));
      const typeMatch = detailCardType === 'all' || card.cardType === detailCardType;
      const searchMatch = !query || haystack.includes(query);

      return statusMatch && typeMatch && searchMatch;
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === 'name') {
        return left.name.localeCompare(right.name) || compareCardNumbers(left.cardNumber, right.cardNumber);
      }
      return compareCardNumbers(left.cardNumber, right.cardNumber) || left.name.localeCompare(right.name);
    });
  }, [selectedCollectionCards, detailSearch, detailStatus, detailCardType, sortMode, stickers]);

  const clearFilters = () => {
    setSearch('');
    setFilters({ sport: 'all', manufacturer: 'all', season: 'all', league: 'all', type: 'all' });
  };

  if (selectedCollectionId && !selectedCollection) {
    return (
      <div className="page-shell">
        <div className="empty-state">
          <h3>Collection not found.</h3>
          <p>The selected collection is no longer available in the local catalogue.</p>
          <button type="button" className="primary-button" onClick={onBackToCollections}>Back to collections</button>
        </div>
      </div>
    );
  }

  if (selectedCollection) {
    const stats = collectionStats.get(selectedCollection.id) || { ownedCount: 0, missingCount: 0, percent: 0 };

    return (
      <div className="page-shell">
        <div className="page-header row-between">
          <div className="breadcrumb-row">
            <span className="eyebrow">Explore Collections</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{selectedCollection.title}</strong>
          </div>
          <button type="button" className="secondary-button" onClick={onBackToCollections}>Back to Collections</button>
        </div>

        <div className="collection-detail-header">
          <div className="collection-cover-wrap">
            {selectedCollection.coverImage ? (
              <img src={selectedCollection.coverImage} alt={selectedCollection.title} className="collection-cover" />
            ) : (
              <div className="collection-cover fallback-cover">
                <span>{getInitials(selectedCollection.title)}</span>
              </div>
            )}
          </div>

          <div className="collection-detail-copy">
            <h1>{selectedCollection.title}</h1>
            <div className="meta-badges">
              {selectedCollection.manufacturer && <span className="chip neutral">{selectedCollection.manufacturer}</span>}
              {selectedCollection.sport && <span className="chip neutral">{selectedCollection.sport}</span>}
              {selectedCollection.season && <span className="chip neutral">{selectedCollection.season}</span>}
              {selectedCollection.league && <span className="chip neutral">{selectedCollection.league}</span>}
            </div>
            <div className="summary-grid collection-stats-grid">
              <div className="metric-card">
                <span>Total cards</span>
                <strong>{selectedCollection.totalCards}</strong>
              </div>
              <div className="metric-card">
                <span>Owned</span>
                <strong>{stats.ownedCount}</strong>
              </div>
              <div className="metric-card">
                <span>Completion</span>
                <strong>{stats.percent}%</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="toolbar-card detail-toolbar">
          <input
            type="search"
            value={detailSearch}
            onChange={(event) => setDetailSearch(event.target.value)}
            placeholder="Search player, team, number or variant"
            aria-label="Search cards in this collection"
          />
          <select value={detailStatus} onChange={(event) => setDetailStatus(event.target.value)}>
            <option value="all">All cards</option>
            <option value="owned">Owned</option>
            <option value="missing">Missing</option>
          </select>
          {cardTypeOptions.length > 1 && (
            <select value={detailCardType} onChange={(event) => setDetailCardType(event.target.value)}>
              {cardTypeOptions.map((type) => (
                <option key={type} value={type}>{type === 'all' ? 'All card types' : type}</option>
              ))}
            </select>
          )}
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="number">Sort by card number</option>
            <option value="name">Sort by card name</option>
          </select>
        </div>

        <div className="page-chip">{visibleSelectedCards.length} cards</div>

        {visibleSelectedCards.length === 0 ? (
          <div className="empty-state">
            <h3>No cards match this collection filter.</h3>
            <p>Adjust the search or ownership filter to browse the set again.</p>
          </div>
        ) : (
          <div className="catalogue-grid collection-detail-grid">
            {visibleSelectedCards.map((card) => {
              const isOwned = (stickers || []).some((item) => item.code === card.code && item.owned);
              return (
                <article className="catalogue-card card-browse" key={card.code}>
                  <div className="catalogue-card__top">
                    <span className="chip neutral">#{card.cardNumber || 'N/A'}</span>
                    {isOwned ? <span className="chip success">Owned</span> : <span className="chip neutral">Missing</span>}
                  </div>
                  <h3>{card.name}</h3>
                  <p>{card.team}</p>
                  <dl className="meta-list compact-meta">
                    {card.cardType && <div><dt>Type</dt><dd>{card.cardType}</dd></div>}
                    {card.variantName && <div><dt>Variant</dt><dd>{card.variantName}</dd></div>}
                    <div><dt>Season</dt><dd>{card.season || 'N/A'}</dd></div>
                  </dl>
                  <div className="card-footer browse-footer">
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

  return (
    <div className="page-shell">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">EXPLORE</p>
          <h1>Explore Collections</h1>
        </div>
        <div className="page-chip">{filteredCollections.length} collections</div>
      </div>

      <p className="page-supporting-text">Discover sets, browse cards and build your collection.</p>

      <div className="toolbar-card collection-filter-panel">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by collection, sport, manufacturer or league"
          aria-label="Search collections"
        />
        <button type="button" className="secondary-button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="filter-grid">
        <label>
          <span>Sport</span>
          <select value={filters.sport} onChange={(event) => setFilters((current) => ({ ...current, sport: event.target.value }))}>
            {sportOptions.map((option) => (
              <option key={option} value={option}>{option === 'all' ? 'All sports' : option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Manufacturer</span>
          <select value={filters.manufacturer} onChange={(event) => setFilters((current) => ({ ...current, manufacturer: event.target.value }))}>
            {manufacturerOptions.map((option) => (
              <option key={option} value={option}>{option === 'all' ? 'All manufacturers' : option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Season</span>
          <select value={filters.season} onChange={(event) => setFilters((current) => ({ ...current, season: event.target.value }))}>
            {seasonOptions.map((option) => (
              <option key={option} value={option}>{option === 'all' ? 'All seasons' : option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>League</span>
          <select value={filters.league} onChange={(event) => setFilters((current) => ({ ...current, league: event.target.value }))}>
            {leagueOptions.map((option) => (
              <option key={option} value={option}>{option === 'all' ? 'All leagues' : option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
            {typeOptions.map((option) => (
              <option key={option} value={option}>{option === 'all' ? 'All collection types' : option}</option>
            ))}
          </select>
        </label>
      </div>

      {filteredCollections.length === 0 ? (
        <div className="empty-state">
          <h3>No collections match your search.</h3>
          <p>Try a different title, league, manufacturer or season and reset the filters to browse the full list.</p>
          <button type="button" className="primary-button" onClick={clearFilters}>Reset filters</button>
        </div>
      ) : (
        <div className="catalogue-grid collection-grid">
          {filteredCollections.map((collection) => {
            const stats = collectionStats.get(collection.id) || { ownedCount: 0, percent: 0 };
            const totalCards = collection.totalCards || getCollectionCards(collection.id).length;
            const cardCountLabel = totalCards === 1 ? '1 card' : `${totalCards} cards`;

            return (
              <button
                type="button"
                key={collection.id}
                className="collection-card collection-tile"
                onClick={() => onSelectCollection(collection.id)}
                aria-label={`View ${collection.title}`}
              >
                <div className="collection-card__cover">
                  {collection.coverImage ? (
                    <img src={collection.coverImage} alt={collection.title} className="collection-cover" />
                  ) : (
                    <div className="collection-cover fallback-cover">
                      <span>{getInitials(collection.title)}</span>
                    </div>
                  )}
                </div>
                <div className="collection-card__content">
                  <div className="collection-card__header">
                    <span className="chip neutral">{collection.manufacturer}</span>
                    <span className="chip neutral">{collection.sport}</span>
                  </div>
                  <h3>{collection.title}</h3>
                  <p>{collection.league || collection.collectionType}</p>
                  <dl className="meta-list compact-meta">
                    <div><dt>Season</dt><dd>{collection.season || 'N/A'}</dd></div>
                    <div><dt>Cards</dt><dd>{cardCountLabel}</dd></div>
                    <div><dt>Owned</dt><dd>{stats.ownedCount} / {totalCards}</dd></div>
                  </dl>
                  <div className="card-footer">
                    <span className="muted">{stats.percent}% complete</span>
                    <span className="inline-link">View collection</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
