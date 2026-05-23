import React, { useState, useEffect } from 'react';
import {
  findUserByEmail,
  searchUsersByEmail,
  getUserCollection,
  sendProposal,
  loadIncomingProposals,
  respondToProposal,
  publishToBoard,
  fetchPublicBoard,
  loadAllTradeHistory,
} from '../services/trades.js';
import { auth } from '../services/firebase.js';

/* ─────────────────────────────────────── */
/*  FIND sub-tab                           */
/* ─────────────────────────────────────── */
function FindTab({ stickers }) {
  const [email,         setEmail]         = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [status,        setStatus]        = useState(null);   // { type: 'loading'|'error'|'ok', msg }
  const [resultInfo,    setResultInfo]    = useState(null);
  const [canGet,        setCanGet]        = useState([]);
  const [theirStickers, setTheirStickers] = useState(null);
  const [showingStickers, setShowingStickers] = useState(false);

  // Handle email search with debounce
  async function handleEmailSearch(value) {
    setEmail(value);
    if (value.length < 2) {
      setSearchResults([]);
    } else {
      const results = await searchUsersByEmail(value);
      setSearchResults(results);
    }
  }

  // Select a user from search results
  async function selectUser(selectedEmail) {
    setEmail(selectedEmail);
    setSearchResults([]);
    setShowingStickers(false);
    await checkTrade(selectedEmail);
  }

  async function checkTrade(emailToCheck) {
    const emailParam = emailToCheck || email;
    if (!emailParam) { setStatus({ type: 'error', msg: 'Please enter an email address.' }); return; }
    setStatus({ type: 'loading', msg: '⏳ Looking up user…' });
    setResultInfo(null); setCanGet([]);
    try {
      const found = await findUserByEmail(emailParam);
      if (!found) { setStatus({ type: 'error', msg: `❌ No user found with email "${emailParam}".` }); return; }
      const friendDups = (found.data.stickers || []).filter(s => s.duplicate || s.dupCount > 0);
      if (!friendDups.length) { setStatus({ type: 'error', msg: `😔 ${emailParam} has no duplicates right now.` }); return; }
      const myMissingCodes = new Set(stickers.filter(s => !s.owned).map(s => s.code));
      const matches = friendDups.filter(s => myMissingCodes.has(s.code));
      setStatus(null);
      setResultInfo({ email: emailParam, friendDups, matches });
      setCanGet(matches);
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    }
  }

  async function viewTheirStickers() {
    if (!email) return;
    setStatus({ type: 'loading', msg: '⏳ Loading their collection…' });
    try {
      const collection = await getUserCollection(email);
      if (!collection) {
        setStatus({ type: 'error', msg: 'Could not load collection' });
        return;
      }
      setTheirStickers(collection);
      setShowingStickers(true);
      setStatus(null);
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    }
  }

  return (
    <div className="trade-section">
      <div className="trade-find-form">
        <h3>🔍 Find Trade Partner</h3>
        <div className="trade-search-row">
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="email"
              placeholder="Search by email..."
              value={email}
              onChange={e => handleEmailSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && checkTrade()}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                maxHeight: 200,
                overflowY: 'auto',
                zIndex: 100,
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
              }}>
                {searchResults.map(user => (
                  <div
                    key={user.uid}
                    onClick={() => selectUser(user.email)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span>{user.email}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{user.completionPct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="btn-trade-search" onClick={() => checkTrade()}>Check</button>
        </div>
      </div>

      {status && (
        <div className={`trade-status ${status.type}`}>{status.msg}</div>
      )}

      {resultInfo && !showingStickers && (
        <div className="trade-result-info">
          <strong>{resultInfo.email}</strong>
          <div className="trade-counts">
            <div className="tc-item">
              <span className="tc-val">{resultInfo.friendDups.length}</span>
              <span className="tc-lbl">Their repeats</span>
            </div>
            <div className="tc-item">
              <span className="tc-val">{resultInfo.matches.length}</span>
              <span className="tc-lbl">You need</span>
            </div>
          </div>
          <button 
            className="btn-contact"
            onClick={viewTheirStickers}
            style={{ marginTop: 12 }}
          >
            👁️ View Their Stickers
          </button>
        </div>
      )}

      {resultInfo && !showingStickers && (
        <div className="trade-need-grid">
          {canGet.length === 0 ? (
            <div className="trade-empty">
              <span className="te-icon">🎉</span>
              You already have all their duplicates!
            </div>
          ) : (
            canGet.map(s => (
              <div key={s.code} className="trade-need-badge">
                <span className="tnb-code">{s.code}</span>
                <span className="tnb-name">{s.name}</span>
                <span className="tnb-team">{s.team}</span>
              </div>
            ))
          )}
        </div>
      )}

      {showingStickers && theirStickers && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>📇 {theirStickers.email}'s Collection</h4>
            <button 
              className="btn-reject"
              onClick={() => setShowingStickers(false)}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              ✕ Close
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 12, background: 'var(--background)', borderRadius: 4, borderLeft: '3px solid var(--green)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Duplicates</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
                {theirStickers.stickers.filter(s => s.duplicate || s.dupCount > 0).length}
              </div>
            </div>
            <div style={{ padding: 12, background: 'var(--background)', borderRadius: 4, borderLeft: '3px solid var(--primary)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Total Owned</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {theirStickers.stickers.filter(s => s.owned).length}
              </div>
            </div>
          </div>

          <div>
            <h5 style={{ marginTop: 0, marginBottom: 8, fontSize: 13 }}>🔄 Their Duplicates (available for trade)</h5>
            <div className="trade-need-grid">
              {theirStickers.stickers.filter(s => s.duplicate || s.dupCount > 0).map(s => (
                <div key={s.code} className="trade-need-badge">
                  <span className="tnb-code">{s.code}</span>
                  <span className="tnb-name">{s.name}</span>
                  <span className="tnb-team">{s.team}</span>
                  {s.dupCount > 1 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>×{s.dupCount}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  PROPOSE sub-tab                        */
/* ─────────────────────────────────────── */
function ProposeTab({ stickers, onTradeAccepted }) {
  const [toEmail,            setToEmail]            = useState('');
  const [toEmailSearch,      setToEmailSearch]      = useState('');
  const [toEmailResults,     setToEmailResults]     = useState([]);
  const [giveCode,           setGiveCode]           = useState('');
  const [wantCode,           setWantCode]           = useState('');
  const [giveSearch,         setGiveSearch]         = useState('');
  const [wantSearch,         setWantSearch]         = useState('');
  const [giveTeamFilter,     setGiveTeamFilter]     = useState('');
  const [wantTeamFilter,     setWantTeamFilter]     = useState('');

  const dups    = stickers.filter(s => s.duplicate && s.dupCount > 0);
  const missing = stickers.filter(s => !s.owned);

  // Get unique teams for filtering
  const dumpTeams = [...new Set(dups.map(s => s.team))].sort();
  const missingTeams = [...new Set(missing.map(s => s.team))].sort();

  // Filter duplicates for dropdown
  const filteredDups = dups
    .filter(s => !giveTeamFilter || s.team === giveTeamFilter)
    .filter(s => !giveSearch || 
      s.code.toLowerCase().includes(giveSearch.toLowerCase()) || 
      s.name.toLowerCase().includes(giveSearch.toLowerCase())
    );

  // Filter missing for dropdown
  const filteredMissing = missing
    .filter(s => !wantTeamFilter || s.team === wantTeamFilter)
    .filter(s => !wantSearch || 
      s.code.toLowerCase().includes(wantSearch.toLowerCase()) || 
      s.name.toLowerCase().includes(wantSearch.toLowerCase())
    );

  // Handle recipient email search
  async function handleRecipientSearch(value) {
    setToEmailSearch(value);
    setToEmail(value);
    if (value.length < 2) {
      setToEmailResults([]);
    } else {
      const results = await searchUsersByEmail(value);
      setToEmailResults(results);
    }
  }

  // Select recipient from search
  function selectRecipient(email) {
    setToEmail(email);
    setToEmailSearch('');
    setToEmailResults([]);
  }

  async function handleSend() {
    const targetEmail = toEmail || toEmailSearch;
    if (!targetEmail || !giveCode || !wantCode) { alert('Fill all fields'); return; }
    const giveSt = stickers.find(s => s.code === giveCode);
    const wantSt = stickers.find(s => s.code === wantCode);
    try {
      const found = await findUserByEmail(targetEmail);
      if (!found) { alert(`User "${targetEmail}" not found.`); return; }
      await sendProposal({
        fromEmail: auth.currentUser.email,
        fromUid:   auth.currentUser.uid,
        fromUserId: auth.currentUser.uid,
        toEmail: targetEmail,
        toUid:     found.uid,
        toUserId:  found.uid,
        giveCode,  giveName: giveSt?.name, giveTeam: giveSt?.team,
        wantCode,  wantName: wantSt?.name, wantTeam: wantSt?.team,
      });
      alert(`✅ Proposal sent to ${targetEmail}!`);
      setToEmail('');
      setToEmailSearch('');
      setGiveCode('');
      setWantCode('');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  return (
    <div className="trade-section">
      <div className="trade-proposal-form">
        <h3>📨 Send Trade Proposal</h3>
        
        <div className="proposal-row">
          <div className="pf-group">
            <label>To (Email)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                placeholder="Search recipient..."
                value={toEmailSearch || toEmail}
                onChange={e => {
                  if (e.target.value !== toEmail) {
                    handleRecipientSearch(e.target.value);
                  }
                }}
                style={{ marginTop: 0 }}
              />
              {toEmailResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  maxHeight: 150,
                  overflowY: 'auto',
                  zIndex: 100,
                  marginTop: 2
                }}>
                  {toEmailResults.map(user => (
                    <div
                      key={user.uid}
                      onClick={() => selectRecipient(user.email)}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        fontSize: 14,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{user.email}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{user.completionPct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="proposal-row">
          <div className="pf-group">
            <label>I Give (my duplicate)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={giveTeamFilter} onChange={e => setGiveTeamFilter(e.target.value)} style={{ fontSize: 12 }}>
                <option value="">All Teams</option>
                {dumpTeams.map(team => <option key={team} value={team}>{team}</option>)}
              </select>
              <input
                type="text"
                placeholder="Search code/name..."
                value={giveSearch}
                onChange={e => setGiveSearch(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
            <select value={giveCode} onChange={e => setGiveCode(e.target.value)}>
              {filteredDups.length === 0
                ? <option>No duplicates match filters</option>
                : filteredDups.map(s => <option key={s.code} value={s.code}>{s.code} – {s.name} ({s.team})</option>)
              }
            </select>
          </div>
          <div className="pf-group">
            <label>I Want (from them)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={wantTeamFilter} onChange={e => setWantTeamFilter(e.target.value)} style={{ fontSize: 12 }}>
                <option value="">All Teams</option>
                {missingTeams.map(team => <option key={team} value={team}>{team}</option>)}
              </select>
              <input
                type="text"
                placeholder="Search code/name..."
                value={wantSearch}
                onChange={e => setWantSearch(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
            <select value={wantCode} onChange={e => setWantCode(e.target.value)}>
              {filteredMissing.length === 0
                ? <option>You own everything!</option>
                : filteredMissing.map(s => <option key={s.code} value={s.code}>{s.code} – {s.name} ({s.team})</option>)
              }
            </select>
          </div>
        </div>
        <button className="btn-send-proposal" onClick={handleSend}>📨 Send Proposal</button>
      </div>

      <IncomingProposals stickers={stickers} onTradeAccepted={onTradeAccepted} />
    </div>
  );
}

function IncomingProposals({ stickers, onTradeAccepted }) {
  const [proposals, setProposals] = useState(null);

  async function load() {
    if (!auth.currentUser) return;
    try {
      const ps = await loadIncomingProposals(auth.currentUser.uid);
      setProposals(ps);
    } catch {
      setProposals([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function respond(propId, action, p) {
    try {
      await respondToProposal(propId, action);
      if (action === 'accept') {
        onTradeAccepted?.(p);
        alert(`✅ Trade accepted! You now own ${p.giveName}.`);
      } else {
        alert('Trade declined.');
      }
      load();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  if (proposals === null) return <div className="trade-empty"><span className="te-icon">⏳</span>Loading…</div>;

  return (
    <>
      <div style={{ marginTop: 16 }}>
        <div className="section-title" style={{ padding: '0 0 0 0' }}>📬 Incoming Proposals</div>
      </div>
      <div className="proposals-list">
        {proposals.length === 0 ? (
          <div className="trade-empty"><span className="te-icon">📭</span>No incoming proposals</div>
        ) : (
          proposals.map(p => (
            <div key={p.id} className="proposal-card">
              <div className="pc-header">
                <span className="pc-from">From: <strong>{p.fromEmail}</strong></span>
                <span className="pc-badge">⏳ Pending</span>
              </div>
              <div className="pc-swap">
                They give: <strong style={{ color: 'var(--green)' }}>{p.giveCode} – {p.giveName}</strong><br />
                They want: <strong style={{ color: 'var(--red)' }}>{p.wantCode} – {p.wantName}</strong>
              </div>
              <div className="pc-actions">
                <button className="btn-accept" onClick={() => respond(p.id, 'accept', p)}>✅ Accept</button>
                <button className="btn-reject" onClick={() => respond(p.id, 'reject', p)}>✕ Decline</button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────── */
/*  BOARD sub-tab                          */
/* ─────────────────────────────────────── */
function BoardTab({ stickers }) {
  const [board, setBoard] = useState(null);

  async function load() {
    try {
      const entries = await fetchPublicBoard();
      setBoard(entries);
    } catch {
      setBoard([]);
    }
  }

  useEffect(() => { load(); }, []);

  async function publish() {
    const dups    = stickers.filter(s => s.duplicate && s.dupCount > 0);
    if (!dups.length) { alert('You have no duplicates to publish!'); return; }
    const missing = stickers.filter(s => !s.owned).slice(0, 20);
    try {
      await publishToBoard(
        auth.currentUser.email,
        auth.currentUser.uid,
        dups.map(s => ({ code: s.code, name: s.name, team: s.team, qty: s.dupCount })),
        missing.map(s => ({ code: s.code, name: s.name })),
      );
      alert('✅ Your duplicates are now on the public trade board!');
      load();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  }

  const myMissing = new Set(stickers.filter(s => !s.owned).map(s => s.code));

  return (
    <div className="trade-section">
      <button
        className="btn-export"
        style={{ marginBottom: 16 }}
        onClick={publish}
      >
        📋 Publish My Duplicates
      </button>

      <div className="public-board-list">
        {board === null ? (
          <div className="trade-empty"><span className="te-icon">⏳</span>Loading…</div>
        ) : board.length === 0 ? (
          <div className="trade-empty"><span className="te-icon">📋</span>Nobody has posted yet. Be the first!</div>
        ) : (
          board
            .filter(entry => entry.email !== auth.currentUser?.email)
            .map(entry => {
              const theyHaveINeed = (entry.dups || []).filter(s => myMissing.has(s.code));
              return (
                <div key={entry.id} className="board-card">
                  <div className="board-card-header">
                    <span className="bc-email">{entry.email}</span>
                    <span className="bc-count">{(entry.dups || []).length} duplicates</span>
                  </div>
                  {theyHaveINeed.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginBottom: 6 }}>
                      ✅ {theyHaveINeed.length} you need!
                    </div>
                  )}
                  <div className="board-dups">
                    {(entry.dups || []).slice(0, 10).map(s => (
                      <span key={s.code} className="board-dup-chip">
                        {s.code}{s.qty > 1 ? ' ×' + s.qty : ''}
                      </span>
                    ))}
                    {(entry.dups || []).length > 10 && (
                      <span className="board-dup-chip">+{(entry.dups || []).length - 10} more</span>
                    )}
                  </div>
                  <button
                    className="btn-contact"
                    onClick={() => window.location.href = `mailto:${entry.email}?subject=Panini WC 2026 Trade`}
                  >
                    📧 Contact
                  </button>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  HISTORY sub-tab                        */
/* ─────────────────────────────────────── */
function HistoryTab({ tradeHistory }) {
  const [allTrades, setAllTrades] = useState(null);

  async function loadHistory() {
    if (!auth.currentUser) return;
    try {
      const trades = await loadAllTradeHistory(auth.currentUser.uid);
      setAllTrades(trades);
    } catch (err) {
      console.error('Error loading history:', err);
      setAllTrades([]);
    }
  }

  useEffect(() => { loadHistory(); }, []);

  const trades = allTrades !== null ? allTrades : [];

  return (
    <div className="trade-section">
      <div className="trade-history-list">
        {trades.length === 0 ? (
          <div className="trade-empty"><span className="te-icon">📜</span>No completed trades yet</div>
        ) : (
          trades.map((t, i) => (
            <div key={i} className="trade-history-card">
              <div className="th-header">
                <span className="th-partner">
                  {t.direction === 'sent' ? '📤' : '📥'} 
                  {t.direction === 'sent' ? t.toEmail : t.fromEmail}
                </span>
                <span className="th-date" style={{ fontSize: 12 }}>
                  {t.status === 'accepted' ? '✅ Accepted' : '❌ Declined'}
                </span>
              </div>
              <div className="th-swap">
                {t.direction === 'sent' ? (
                  <>
                    <span className="th-gave">You gave: {t.giveName}</span>
                    <span className="th-arrow">↔️</span>
                    <span className="th-got">You want: {t.wantName}</span>
                  </>
                ) : (
                  <>
                    <span className="th-gave">You got: {t.giveName}</span>
                    <span className="th-arrow">↔️</span>
                    <span className="th-got">You gave: {t.wantName}</span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  Main TradePage                         */
/* ─────────────────────────────────────── */
export default function TradePage({ stickers, tradeHistory, onTradeAccepted }) {
  const [activeTab, setActiveTab] = useState('find');

  const tabs = [
    { id: 'find',    label: '🔍 Find'    },
    { id: 'propose', label: '📨 Propose' },
    { id: 'board',   label: '📋 Board'   },
    { id: 'history', label: '📜 History' },
  ];

  return (
    <section id="tradeCheckPage">
      <div className="trade-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`trade-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'find'    && <FindTab    stickers={stickers} />}
      {activeTab === 'propose' && <ProposeTab stickers={stickers} onTradeAccepted={onTradeAccepted} />}
      {activeTab === 'board'   && <BoardTab   stickers={stickers} />}
      {activeTab === 'history' && <HistoryTab tradeHistory={tradeHistory} />}
    </section>
  );
}
