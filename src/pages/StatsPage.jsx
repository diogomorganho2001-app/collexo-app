import React, { useState, useEffect } from 'react';
import { fetchLeaderboard } from '../services/leaderboard.js';
import { auth } from '../services/firebase.js';

export default function StatsPage({ stickers, onTeamClick }) {
  const [leaderboard, setLeaderboard] = useState(null);

  useEffect(() => {
    fetchLeaderboard()
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]));
  }, []);

  const teams = [...new Set(stickers.map(s => s.team))].sort();

  const rankEmoji  = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null;
  const rankClass  = r => r === 1 ? 'gold' : r === 2 ? 'silver' : r === 3 ? 'bronze' : '';
  const myEmail    = auth.currentUser?.email;

  return (
    <section id="statsPage">
      {/* Team Breakdown */}
      <div className="team-breakdown info-section" style={{ paddingTop: 20 }}>
        <div className="section-title">🌍 Team Progress</div>
        <div className="team-breakdown-grid">
          {teams.map(team => {
            const ts       = stickers.filter(s => s.team === team);
            const owned    = ts.filter(s => s.owned).length;
            const pct      = Math.round((owned / ts.length) * 100);
            const complete = owned === ts.length;
            return (
              <div
                key={team}
                className={'team-row' + (complete ? ' complete' : '')}
                onClick={() => onTeamClick(team)}
              >
                <span className="tr-name">{complete ? '✅ ' : ''}{team}</span>
                <span className="tr-count">{owned}/{ts.length}</span>
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

      {/* Leaderboard */}
      <div className="info-section">
        <div className="section-title">🏆 Leaderboard</div>
        <div className="leaderboard-list">
          {leaderboard === null ? (
            <div className="trade-empty"><span className="te-icon">⏳</span>Loading…</div>
          ) : leaderboard.length === 0 ? (
            <div className="trade-empty">No users yet</div>
          ) : (
            leaderboard.map((entry, idx) => {
              const rank  = idx + 1;
              const isMe  = entry.email === myEmail;
              const emoji = rankEmoji(rank);
              return (
                <div key={entry.uid} className="lb-row">
                  <span className={`lb-rank ${rankClass(rank)}`}>{emoji || rank}</span>
                  <span className={`lb-email${isMe ? ' me' : ''}`}>
                    {isMe ? `⭐ You (${entry.email})` : entry.email || 'Anonymous'}
                  </span>
                  <span className="lb-pct">{entry.completionPct || 0}%</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
