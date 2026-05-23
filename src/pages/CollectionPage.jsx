import React, { useState, useMemo, useEffect } from 'react';

export default function CollectionPage({ stickers, onToggleOwned, onAddDup, onRemoveDup, onBulkOwned, onBulkDup, onToggleWanted, initialTeam }) {
  const [search,       setSearch]       = useState('');
  const [teamFilter,   setTeamFilter]   = useState(initialTeam || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [bulkMode,     setBulkMode]     = useState(false);
  const [selected,     setSelected]     = useState(new Set());

  const teams = useMemo(() => [...new Set(stickers.map(s => s.team))].sort(), [stickers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return stickers.filter(s => {
      if (q && !`${s.code} ${s.name} ${s.team}`.toLowerCase().includes(q)) return false;
      if (teamFilter   && s.team !== teamFilter)                   return false;
      if (statusFilter === 'owned'     && !s.owned)                return false;
      if (statusFilter === 'missing'   &&  s.owned)                return false;
      if (statusFilter === 'duplicate' && !s.duplicate)            return false;
      if (statusFilter === 'wanted'    && !s.wanted)              return false;
      return true;
    });
  }, [stickers, search, teamFilter, statusFilter]);

  // Reset teamFilter when parent changes initialTeam (from Stats page click)
  React.useEffect(() => {
    if (initialTeam) setTeamFilter(initialTeam);
  }, [initialTeam]);

  function toggleSelect(code) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  function selectAll(checked) {
    if (checked) {
      setSelected(new Set(filtered.map(s => s.code)));
    } else {
      setSelected(new Set());
    }
  }

  function handleBulkOwned() {
    onBulkOwned([...selected]);
    setBulkMode(false);
    setSelected(new Set());
  }

  function handleBulkDup() {
    onBulkDup([...selected]);
    setBulkMode(false);
    setSelected(new Set());
  }

  return (
    <section id="collectionPage">
      {/* Controls */}
      <div className="collection-controls">
        <input
          placeholder="Search sticker, name, team…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
          <option value="">All Teams</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="owned">Owned</option>
          <option value="missing">Missing</option>
          <option value="duplicate">Duplicates</option>
          <option value="wanted">Want list</option>
        </select>
        <button
          className="btn-bulk"
          style={{ background: bulkMode ? 'rgba(240,180,41,.3)' : 'rgba(240,180,41,.1)' }}
          onClick={() => { setBulkMode(b => !b); setSelected(new Set()); }}
        >
          ☑️ Bulk
        </button>
      </div>

      {bulkMode && (
        <div className="bulk-actions-bar">
          <span className="bulk-count">{selected.size} selected</span>
          <button className="btn-bulk" onClick={handleBulkOwned}>✅ Mark Owned</button>
          <button className="btn-bulk" onClick={handleBulkDup}>🔄 Mark Dup</button>
          <button className="btn-bulk-cancel" onClick={() => { setBulkMode(false); setSelected(new Set()); }}>✕ Cancel</button>
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {bulkMode && (
                <th className="bulk-check-header">
                  <input
                    type="checkbox"
                    className="select-checkbox"
                    onChange={e => selectAll(e.target.checked)}
                  />
                </th>
              )}
              <th>Code</th>
              <th>Name</th>
              <th>Team</th>
              <th>Status</th>
              <th>Wish</th>
              <th>Repeated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(sticker => {
              const dupCount = sticker.dupCount || 0;
              const hasDup   = dupCount > 0;
              const isSel    = selected.has(sticker.code);

              return (
                <tr
                  key={sticker.code}
                  className={[
                    sticker.owned ? 'have-row' : '',
                    bulkMode && isSel ? 'selected-row' : '',
                  ].join(' ')}
                  data-code={sticker.code}
                >
                  {bulkMode && (
                    <td>
                      <input
                        type="checkbox"
                        className="select-checkbox"
                        checked={isSel}
                        onChange={() => toggleSelect(sticker.code)}
                      />
                    </td>
                  )}
                  <td>{sticker.code}</td>
                  <td>{sticker.name}</td>
                  <td>{sticker.team}</td>
                  <td>
                    <button
                      className="have-btn"
                      onClick={() => onToggleOwned(sticker.code)}
                    >
                      {sticker.owned ? '✅ Owned' : 'Missing'}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`want-btn${sticker.wanted ? ' active' : ''}`}
                      onClick={() => onToggleWanted(sticker.code)}
                    >
                      {sticker.wanted ? '❤️ Wanted' : '♡ Want'}
                    </button>
                  </td>
                  <td>
                    <div className={`dup-qty-btn${hasDup ? ' has-dup' : ''}`}>
                      <span className="dq-label">
                        {hasDup ? '🔄 ×' + dupCount : 'No dup'}
                      </span>
                      {sticker.owned && (
                        <button
                          className="dq-count"
                          title="Add duplicate"
                          onClick={e => { e.stopPropagation(); onAddDup(sticker.code); }}
                        >+</button>
                      )}
                      {hasDup && (
                        <button
                          className="dq-count"
                          title="Remove one"
                          onClick={e => { e.stopPropagation(); onRemoveDup(sticker.code); }}
                        >-</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
