import React, { useState, useEffect } from 'react';
import {
  findUserByEmail,
  sendProposal,
  loadIncomingProposals,
  respondToProposal,
  publishToBoard,
  fetchPublicBoard,
} from '../services/trades.js';
import { auth } from '../services/firebase.js';

/* ─────────────────────────────────────── */
/*  FIND sub-tab                           */
/* ─────────────────────────────────────── */
function FindTab({ stickers }) {
  const [email,         setEmail]         = useState('');
  const [status,        setStatus]        = useState(null);   // { type: 'loading'|'error'|'ok', msg }
  const [resultInfo,    setResultInfo]    = useState(null);
  const [canGet,        setCanGet]        = useState([]);

  async function checkTrade() {
    if (!email) { setStatus({ type: 'error', msg: 'Please enter an email address.' }); return; }
    setStatus({ type: 'loading', msg: '⏳ Looking up user…' });
    setResultInfo(null); setCanGet([]);
    try {
      const found = await findUserByEmail(email);
      if (!found) { setStatus({ type: 'error', msg: `❌ No user found with email "${email}".` }); return; }
      const friendDups = (found.data.stickers || []).filter(s => s.duplicate || s.dupCount > 0);
      if (!friendDups.length) { setStatus({ type: 'error', msg: `😔 ${email} has no duplicates right now.` }); return; }
      const myMissingCodes = new Set(stickers.filter(s => !s.owned).map(s => s.code));
      const matches = friendDups.filter(s => myMissingCodes.has(s.code));
      setStatus(null);
      setResultInfo({ email, friendDups, matches });
      setCanGet(matches);
    } catch (err) {
      setStatus({ type: 'error', msg: `❌ Error: ${err.message}` });
    }
  }

  return (
    <div className="trade-section">
      <div className="trade-find-form">
        <h3>🔍 Check Trade Partner</h3>
        <div className="trade-search-row">
          <input
            type="email"
            placeholder="friend@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkTrade()}
          />
          <button className="btn-trade-search" onClick={checkTrade}>Check</button>
        </div>
      </div>

      {status && (
        <div className={`trade-status ${status.type}`}>{status.msg}</div>
      )}

      {resultInfo && (
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
        </div>
      )}

      {resultInfo && (
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
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  PROPOSE sub-tab                        */
/* ─────────────────────────────────────── */
function ProposeTab({ stickers }) {
  const [toEmail,   setToEmail]   = useState('');
  const [giveCode,  setGiveCode]  = useState('');
  const [wantCode,  setWantCode]  = useState('');

  const dups    = stickers.filter(s => s.duplicate && s.dupCount > 0);
  const missing = stickers.filter(s => !s.owned);

  async function handleSend() {
    if (!toEmail || !giveCode || !wantCode) { alert('Fill all fields'); return; }
    const giveSt = stickers.find(s => s.code === giveCode);
    const wantSt = stickers.find(s => s.code === wantCode);
    try {
      const found = await findUserByEmail(toEmail);
      if (!found) { alert(`User "${toEmail}" not found.`); return; }
      await sendProposal({
        fromEmail: auth.currentUser.email,
        fromUid:   auth.currentUser.uid,
        toEmail,
        toUid:     found.uid,
        giveCode,  giveName: giveSt?.name, giveTeam: giveSt?.team,
        wantCode,  wantName: wantSt?.name, wantTeam: wantSt?.team,
      });
      alert(`✅ Proposal sent to ${toEmail}!`);
      setToEmail('');
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
            <input
              type="email"
              placeholder="friend@email.com"
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              style={{ marginTop: 0 }}
            />
          </div>
        </div>
        <div className="proposal-row">
          <div className="pf-group">
            <label>I Give (my duplicate)</label>
            <select value={giveCode} onChange={e => setGiveCode(e.target.value)}>
              {dups.length === 0
                ? <option>No duplicates available</option>
                : dups.map(s => <option key={s.code} value={s.code}>{s.code} – {s.name} ({s.team})</option>)
              }
            </select>
          </div>
          <div className="pf-group">
            <label>I Want (from them)</label>
            <select value={wantCode} onChange={e => setWantCode(e.target.value)}>
              {missing.length === 0
                ? <option>You own everything!</option>
                : missing.map(s => <option key={s.code} value={s.code}>{s.code} – {s.name} ({s.team})</option>)
              }
            </select>
          </div>
        </div>
        <button className="btn-send-proposal" onClick={handleSend}>📨 Send Proposal</button>
      </div>

      <IncomingProposals stickers={stickers} />
    </div>
  );
}

function IncomingProposals({ stickers, onTradeAccepted }) {
  const [proposals, setProposals] = useState(null);

  async function load() {
    if (!auth.currentUser) return;
    try {
      const ps = await loadIncomingProposals(auth.currentUser.email);
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
  const reversed = [...tradeHistory].reverse();
  return (
    <div className="trade-section">
      <div className="trade-history-list">
        {reversed.length === 0 ? (
          <div className="trade-empty"><span className="te-icon">📜</span>No completed trades yet</div>
        ) : (
          reversed.map((t, i) => (
            <div key={i} className="trade-history-card">
              <div className="th-header">
                <span className="th-partner">🤝 {t.partner}</span>
                <span className="th-date">{t.date}</span>
              </div>
              <div className="th-swap">
                <span className="th-gave">Gave: {t.gaveName}</span>
                <span className="th-arrow">↔️</span>
                <span className="th-got">Got: {t.gotName}</span>
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
