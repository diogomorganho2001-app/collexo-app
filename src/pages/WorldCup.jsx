import React, { useState, useEffect } from 'react';
import metadata from '../../metadata.json';
import CollectionPage from './CollectionPage.jsx';
import DuplicatesPage from './DuplicatesPage.jsx';
import TradePage from './TradePage.jsx';
import StatsPage from './StatsPage.jsx';

export default function WorldCupPage({
  stickers,
  tradeHistory,
  onTeamClick,
  onToggleOwned,
  onAddDup,
  onRemoveDup,
  onBulkOwned,
  onBulkDup,
  onRemoveAllDup,
  onTradeAccepted,
  initialTeam,
  initialTab = 'collection',
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedTeam, setSelectedTeam] = useState(initialTeam || '');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setSelectedTeam(initialTeam || '');
  }, [initialTeam]);

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

  const handleTeamSelect = (team) => {
    setActiveTab('collection');
    onTeamClick(team);
  };

  return (
    <section id="worldCupPage">
      <div className="home-hero">
        <img
          src="/worldcup_page_image.jpg"
          alt="World Cup hero"
          className="hero-bg-image"
        />
        <h2 className="hero-title">⚽ FIFA World Cup 2026</h2>
        <p className="hero-subtitle">{metadata.hostSubtitle}</p>
        <div className="host-strip">
          {metadata.hosts.map((h, i) => (
            <div key={h} className="host-pill">{metadata.hostFlags[i]} {h}</div>
          ))}
          <div className="host-pill">📅 {metadata.dates}</div>
        </div>
      </div>



      <div className="worldcup-summary">
        <div className="stats">
          <div className="stat-card owned">
            <span className="stat-icon">✅</span>
            <div className="stat-val">{owned}</div>
            <div className="stat-lbl">Owned</div>
          </div>
          <div className="stat-card missing">
            <span className="stat-icon">🔍</span>
            <div className="stat-val">{missing}</div>
            <div className="stat-lbl">Missing</div>
          </div>
          <div className="stat-card repeated">
            <span className="stat-icon">🔄</span>
            <div className="stat-val">{duplicates}</div>
            <div className="stat-lbl">Repeated</div>
          </div>
          <div className="stat-card total">
            <span className="stat-icon">📚</span>
            <div className="stat-val">{stickers.length}</div>
            <div className="stat-lbl">Total</div>
          </div>
        </div>

        <div className="worldcup-progress">
          <div className="worldcup-progress-header">
            <span>Completion</span>
            <strong>{percent}%</strong>
          </div>
          <div className="worldcup-progress-track">
            <div className="worldcup-progress-fill" style={{ width: percent + '%' }} />
          </div>
        </div>
      </div>
      
      <div className="worldcup-tabs">
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
      <div className="worldcup-content">
        {activeTab === 'collection' && (
          <CollectionPage
            stickers={stickers}
            onToggleOwned={onToggleOwned}
            onAddDup={onAddDup}
            onRemoveDup={onRemoveDup}
            onBulkOwned={onBulkOwned}
            onBulkDup={onBulkDup}
            initialTeam={selectedTeam}
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
            onTeamClick={handleTeamSelect}
          />
        )}
      </div>
    </section>
  );
}
