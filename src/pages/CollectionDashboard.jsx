import React, { useState, useEffect } from 'react';
import { catalogueMeta } from '../services/catalogue.js';
import CollectionPage from './CollectionPage.jsx';
import DuplicatesPage from './DuplicatesPage.jsx';
import TradePage from './TradePage.jsx';
import StatsPage from './StatsPage.jsx';

export default function CollectionDashboard({
  stickers,
  tradeHistory,
  onClubClick,
  onToggleOwned,
  onToggleWanted,
  onAddDup,
  onRemoveDup,
  onBulkOwned,
  onBulkDup,
  onRemoveAllDup,
  onTradeAccepted,
  initialClub,
  initialTab = 'collection',
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedClub, setSelectedClub] = useState(initialClub || '');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setSelectedClub(initialClub || '');
  }, [initialClub]);

  const owned      = stickers.filter(s => s.owned).length;
  const missing    = stickers.length - owned;
  const duplicates = stickers.filter(s => s.duplicate).length;
  const percent    = stickers.length ? Math.floor((owned / stickers.length) * 100) : 0;

  const tabs = [
    { id: 'collection', label: '📋 Collection' },
    { id: 'duplicates', label: '🔄 Repeated' },
    { id: 'trade',      label: '🤝 Trade'    },
    { id: 'stats',      label: '📊 Stats'    },
  ];

  const handleClubSelect = (club) => {
    setActiveTab('collection');
    onClubClick(club);
  };

  const setLabel = catalogueMeta.setName || 'Sports Card Set';
  const sportLabel = catalogueMeta.sport ? catalogueMeta.sport.charAt(0).toUpperCase() + catalogueMeta.sport.slice(1) : 'Sport';

  return (
    <section id="collectionDashboard">
      <div className="home-hero">
        <img
          src="/Collexo_banner_pic.png"
          alt="Collexo collection hero"
          className="hero-bg-image"
        />
        <h2 className="hero-title">COLLEXO</h2>
        <p className="hero-subtitle">{setLabel}</p>
        <div className="host-strip">
          <div className="host-pill">🏷️ {catalogueMeta.manufacturer}</div>
          <div className="host-pill">⚽ {sportLabel}</div>
          <div className="host-pill">📅 {catalogueMeta.season}</div>
          <div className="host-pill">🏆 {catalogueMeta.league || 'Collection'}</div>
        </div>
      </div>



      <div className="collection-summary">
        <div className="stats">
          <div className="stat-card owned">
            <div className="stat-icon-wrap">✅</div>
            <div className="stat-val">{owned}</div>
            <div className="stat-lbl">Owned</div>
          </div>
          <div className="stat-card missing">
            <div className="stat-icon-wrap">🔍</div>
            <div className="stat-val">{missing}</div>
            <div className="stat-lbl">Missing</div>
          </div>
          <div className="stat-card repeated">
            <div className="stat-icon-wrap">🔄</div>
            <div className="stat-val">{duplicates}</div>
            <div className="stat-lbl">Repeated</div>
          </div>
          <div className="stat-card total">
            <div className="stat-icon-wrap">📚</div>
            <div className="stat-val">{stickers.length}</div>
            <div className="stat-lbl">Total</div>
          </div>
        </div>

        <div className="collection-progress">
          <div className="collection-progress-header">
            <span>Completion</span>
            <strong>{percent}%</strong>
          </div>
          <div className="collection-progress-track">
            <div className="collection-progress-fill" style={{ width: percent + '%' }} />
          </div>
        </div>
      </div>

      <div className="collection-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            id={`${tab.id}Tab`}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="collection-content">
        {activeTab === 'collection' && (
          <CollectionPage
            stickers={stickers}
            onToggleOwned={onToggleOwned}
            onAddDup={onAddDup}
            onRemoveDup={onRemoveDup}
            onBulkOwned={onBulkOwned}
            onBulkDup={onBulkDup}
            onToggleWanted={onToggleWanted}
            initialTeam={selectedClub}
          />
        )}

        {activeTab === 'duplicates' && (
          <DuplicatesPage
            stickers={stickers}
            onRemoveAllDup={onRemoveAllDup}
          />
        )}

        {activeTab === 'trade' && (
          <TradePage
            stickers={stickers}
            tradeHistory={tradeHistory}
            onTradeAccepted={onTradeAccepted}
          />
        )}

        {activeTab === 'stats' && (
          <StatsPage
            stickers={stickers}
            onClubClick={handleClubSelect}
          />
        )}
      </div>
    </section>
  );
}
