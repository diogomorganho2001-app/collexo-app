import React, { useState, useEffect, useCallback } from 'react';
import { useAuth }           from './hooks/useAuth.js';
import { useCollection }     from './hooks/useCollection.js';
import { logout }            from './services/auth.js';
import { checkMilestones, launchConfetti } from './utils/milestones.js';

import AuthPage        from './pages/AuthPage.jsx';
import HomePage        from './pages/HomePage.jsx';
import WorldCupPage    from './pages/WorldCup.jsx';
import CompactStats    from './components/CompactStats.jsx';
import MilestoneToast  from './components/MilestoneToast.jsx';

export default function App() {
  const { user, loading } = useAuth();

  const {
    stickers, setStickers,
    tradeHistory, setTradeHistory,
    milestonesSeen, setMilestonesSeen,
    loadData, persistData, ready,
    stickersRef, tradeHistoryRef, milestoneSeenRef,
  } = useCollection(user);

  const [activePage,   setActivePage]   = useState('home');
  const [lightMode,    setLightMode]    = useState(false);
  const [toasts,       setToasts]       = useState([]);
  const [teamNavTarget, setTeamNavTarget] = useState('');

  // Load user data when auth resolves
  useEffect(() => {
    if (user) loadData(user.uid);
  }, [user]);

  // Apply light mode class to body
  useEffect(() => {
    document.body.classList.toggle('light-mode', lightMode);
  }, [lightMode]);

  // ── Helper: fire milestones then persist ────────────────────────────────
  const afterChange = useCallback(async (updatedStickers, updatedMilestonesSeen) => {
    const ms      = updatedMilestonesSeen ?? milestoneSeenRef.current;
    const newToasts = checkMilestones(updatedStickers, ms);
    if (newToasts.length) {
      setToasts(newToasts);
      setMilestonesSeen({ ...ms });
      milestoneSeenRef.current = ms;
      if (newToasts.some(t => t.includes('ALBUM COMPLETE'))) launchConfetti();
    }
    stickersRef.current      = updatedStickers;
    milestoneSeenRef.current = ms;
    setStickers([...updatedStickers]);
    await persistData();
  }, [persistData]);

  // ── Sticker mutations ────────────────────────────────────────────────────
  const handleToggleOwned = useCallback(async (code) => {
    const next = stickersRef.current.map(s => {
      if (s.code !== code) return s;
      const owned = !s.owned;
      return { ...s, owned, duplicate: owned ? s.duplicate : false, dupCount: owned ? s.dupCount : 0 };
    });
    await afterChange(next);
  }, [afterChange]);

  const handleAddDup = useCallback(async (code) => {
    const s = stickersRef.current.find(s => s.code === code);
    if (!s?.owned) { alert('Own this sticker first.'); return; }
    const next = stickersRef.current.map(s =>
      s.code === code
        ? { ...s, dupCount: (s.dupCount || 0) + 1, duplicate: true }
        : s
    );
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData]);

  const handleRemoveDup = useCallback(async (code) => {
    const next = stickersRef.current.map(s => {
      if (s.code !== code) return s;
      const dc = Math.max(0, (s.dupCount || 0) - 1);
      return { ...s, dupCount: dc, duplicate: dc > 0 };
    });
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData]);

  const handleRemoveAllDup = useCallback(async (code) => {
    const next = stickersRef.current.map(s =>
      s.code === code ? { ...s, dupCount: 0, duplicate: false } : s
    );
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData]);

  const handleBulkOwned = useCallback(async (codes) => {
    const codeSet = new Set(codes);
    const next = stickersRef.current.map(s =>
      codeSet.has(s.code) ? { ...s, owned: true } : s
    );
    await afterChange(next);
  }, [afterChange]);

  const handleBulkDup = useCallback(async (codes) => {
    const codeSet = new Set(codes);
    const next = stickersRef.current.map(s => {
      if (!codeSet.has(s.code) || !s.owned) return s;
      return { ...s, dupCount: (s.dupCount || 0) + 1, duplicate: true };
    });
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData]);

  // ── Trade accepted (from proposals) ─────────────────────────────────────
  const handleTradeAccepted = useCallback(async (proposal) => {
    const next = stickersRef.current.map(s => {
      if (s.code === proposal.giveCode) return { ...s, owned: true };
      if (s.code === proposal.wantCode && s.dupCount > 0) {
        const dc = s.dupCount - 1;
        return { ...s, dupCount: dc, duplicate: dc > 0 };
      }
      return s;
    });
    const newHistory = [
      ...tradeHistoryRef.current,
      {
        partner:  proposal.fromEmail,
        gave:     proposal.wantCode,
        gaveName: proposal.wantName || proposal.wantCode,
        got:      proposal.giveCode,
        gotName:  proposal.giveName || proposal.giveCode,
        date:     new Date().toLocaleDateString(),
      },
    ];
    setTradeHistory(newHistory);
    tradeHistoryRef.current = newHistory;
    await afterChange(next);
  }, [afterChange]);

  // ── Team click: jump to World Cup collection filtered by team ─────────
  const handleTeamClick = useCallback((team) => {
    setTeamNavTarget(team);
    setActivePage('worldcup');
  }, []);

  // ── Loading / auth guard ─────────────────────────────────────────────────
  if (loading) return null;
  if (!user)   return <AuthPage />;
  if (!ready)  return null;

  const navItems = [
    { id: 'home',      label: '🏠 Home'       },
    { id: 'worldcup',  label: '🌍 World Cup'  },
  ];

  return (
    <div id="appPage">
      <header>
        <div className="header-top">
          <div className="brand">
            <h1>Collexo</h1>
            <span>Collections Tracker</span>
          </div>
          <div className="header-actions">
            <button className="btn-theme" onClick={() => setLightMode(m => !m)}>
              {lightMode ? '☀️' : '🌙'}
            </button>
            <button className="btn-logout" onClick={logout}>Sign Out</button>
          </div>
        </div>

        <div className="nav">
          {navItems.map(item => (
            <button
              key={item.id}
              id={`${item.id}Tab`}
              className={activePage === item.id ? 'active' : ''}
              onClick={() => setActivePage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {activePage === 'worldcup' && <CompactStats stickers={stickers} />}
      </header>

      <div className="container">
        <div className={activePage === 'home' ? '' : 'hidden'}>
          <HomePage
            onEnterWorldCup={() => setActivePage('worldcup')}
          />
        </div>
        <div className={activePage === 'worldcup' ? '' : 'hidden'}>
          <WorldCupPage
            stickers={stickers}
            tradeHistory={tradeHistory}
            onTeamClick={handleTeamClick}
            onToggleOwned={handleToggleOwned}
            onAddDup={handleAddDup}
            onRemoveDup={handleRemoveDup}
            onBulkOwned={handleBulkOwned}
            onBulkDup={handleBulkDup}
            onRemoveAllDup={handleRemoveAllDup}
            onTradeAccepted={handleTradeAccepted}
            initialTeam={teamNavTarget}
          />
        </div>
      </div>

      <MilestoneToast
        messages={toasts}
        onDone={() => setToasts([])}
      />
    </div>
  );
}
