import React from 'react';
import metadata from '../../data/collections/worldcup2026/metadata.json';

export default function HomePage({ stickers, onTeamClick }) {
  const owned      = stickers.filter(s => s.owned).length;
  const missing    = stickers.length - owned;
  const duplicates = stickers.filter(s => s.duplicate).length;
  const percent    = stickers.length ? Math.floor((owned / stickers.length) * 100) : 0;

  const teams = [...new Set(stickers.map(s => s.team))].sort();

  return (
    <section id="homePage">
      {/* ── Hero ── */}
      <div className="home-hero">
        <svg className="hero-bg-svg" viewBox="0 0 400 180" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
          <ellipse cx="200" cy="220" rx="280" ry="160" stroke="white" strokeWidth="1.5" fill="none"/>
          <ellipse cx="200" cy="220" rx="220" ry="120" stroke="white" strokeWidth="1" fill="none"/>
          <ellipse cx="200" cy="220" rx="160" ry="80"  stroke="white" strokeWidth="1" fill="none"/>
          <line x1="200" y1="60"  x2="200" y2="220" stroke="white" strokeWidth="1"/>
          <line x1="0"   y1="140" x2="400" y2="140" stroke="white" strokeWidth="1"/>
          <circle cx="200" cy="140" r="30" stroke="white" strokeWidth="1" fill="none"/>
          <rect x="155" y="140" width="90" height="50"  stroke="white" strokeWidth="1" fill="none"/>
          <rect x="175" y="140" width="50" height="25" stroke="white" strokeWidth="1" fill="none"/>
        </svg>
        <div className="hero-badge">⚽ FIFA World Cup 2026</div>
        <h2 className="hero-title">MY PANINI<br /><span className="year">COLLECTION</span></h2>
        <p className="hero-subtitle">{metadata.hostSubtitle}</p>
        <div className="host-strip">
          {metadata.hosts.map((h, i) => (
            <div key={h} className="host-pill">{metadata.hostFlags[i]} {h}</div>
          ))}
          <div className="host-pill">📅 {metadata.dates}</div>
        </div>
      </div>

      {/* ── Stat cards ── */}
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

      {/* ── Progress ── */}
      <div className="progress-section">
        <div className="progress-header">
          <span>🏆 Album Completion</span>
          <strong>{percent}%</strong>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: percent + '%' }} />
        </div>
      </div>

      {/* ── About ── */}
      <div className="info-section">
        <div className="section-title">📖 About the Album</div>
        <div className="album-card">
          <div className="album-img">📒</div>
          <div className="album-info">
            <h3>{metadata.name}</h3>
            <p>
              {metadata.totalStickers.toLocaleString()} stickers across 48 nations.<br />
              {metadata.description}
            </p>
          </div>
        </div>
      </div>

      {/* ── Host cities ── */}
      <div className="info-section">
        <div className="section-title">🏟️ Host Cities</div>
        <div className="cities-grid">
          {metadata.cities.map(city => (
            <div key={city.name} className="city-card">
              <span className="city-flag">{city.flag}</span>
              <div className="city-name">{city.name}</div>
              <div className="city-meta">{city.stadium} · {city.capacity}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Team breakdown ── */}
      <div className="team-breakdown info-section">
        <div className="section-title">🌍 By Team</div>
        <div className="team-breakdown-grid">
          {teams.map(team => {
            const ts       = stickers.filter(s => s.team === team);
            const tOwned   = ts.filter(s => s.owned).length;
            const pct      = Math.round((tOwned / ts.length) * 100);
            const complete = tOwned === ts.length;
            return (
              <div
                key={team}
                className={'team-row' + (complete ? ' complete' : '')}
                onClick={() => onTeamClick(team)}
              >
                <span className="tr-name">{complete ? '✅ ' : ''}{team}</span>
                <span className="tr-count">{tOwned}/{ts.length}</span>
                <div className="tr-bar">
                  <div className="tr-bar-fill" style={{ width: pct + '%' }} />
                </div>
                <span
                  className="tr-pct"
                  style={{ color: pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--muted)' }}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
