import React from 'react';

export default function ProfilePage({ user, stickers }) {
  const ownedCount = (stickers || []).filter((card) => card.owned).length;
  const completion = (stickers || []).length ? Math.round((ownedCount / (stickers || []).length) * 100) : 0;

  return (
    <div className="page-shell">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>Profile & Settings</h1>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">{(user?.email || 'C').slice(0, 1).toUpperCase()}</div>
        <div>
          <h3>{user?.displayName || user?.email?.split('@')[0] || 'Collector'}</h3>
          <p>{user?.email || 'No email available'}</p>
        </div>
      </div>

      <div className="summary-grid">
        <div className="metric-card">
          <span>Collection size</span>
          <strong>{(stickers || []).length}</strong>
        </div>
        <div className="metric-card">
          <span>Owned cards</span>
          <strong>{ownedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Completion</span>
          <strong>{completion}%</strong>
        </div>
      </div>
    </div>
  );
}
