import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useCollection } from './hooks/useCollection.js';
import { logout } from './services/auth.js';
import { checkMilestones, launchConfetti } from './utils/milestones.js';

import AuthPage from './pages/AuthPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import CollectionDashboard from './pages/CollectionDashboard.jsx';
import ExploreCollectionsPage from './pages/ExploreCollectionsPage.jsx';
import MarketPage from './pages/MarketPage.jsx';
import WatchlistPage from './pages/WatchlistPage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import ListsPage from './pages/ListsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import TradePage from './pages/TradePage.jsx';
import CompactStats from './components/CompactStats.jsx';
import MilestoneToast from './components/MilestoneToast.jsx';
import { ensurePublicProfile } from './services/profiles.js';

const AUTH_ROUTES = new Set(['signin', 'register']);
const APP_ROUTES = new Set(['collection', 'explore', 'market', 'portfolio', 'watchlist', 'lists', 'trades', 'profile']);

function getCurrentHashRoute() {
  if (typeof window === 'undefined') return { route: 'collection', collectionId: null, listId: null };
  const hash = window.location.hash.replace(/^#/, '').trim();
  if (!hash) return { route: 'collection', collectionId: null, listId: null };
  if (hash === 'explore') return { route: 'explore', collectionId: null, listId: null };
  if (hash.startsWith('explore/')) {
    return {
      route: 'explore',
      collectionId: decodeURIComponent(hash.replace(/^explore\//, '')),
      listId: null,
    };
  }
  if (hash.startsWith('lists/')) {
    return {
      route: 'lists',
      collectionId: null,
      listId: decodeURIComponent(hash.replace(/^lists\//, '')),
    };
  }
  return { route: hash, collectionId: null, listId: null };
}

export default function App() {
  const { user, loading } = useAuth();
  const initialRoute = getCurrentHashRoute();
  const [route, setRoute] = useState(initialRoute.route);
  const [selectedCollectionId, setSelectedCollectionId] = useState(initialRoute.collectionId);
  const [selectedListId, setSelectedListId] = useState(initialRoute.listId);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [clubNavTarget, setClubNavTarget] = useState('');

  const {
    stickers, setStickers,
    tradeHistory, setTradeHistory,
    milestonesSeen, setMilestonesSeen,
    lists, setLists,
    loadData, persistData, ready,
    stickersRef, tradeHistoryRef, milestoneSeenRef, listsRef,
  } = useCollection(user);

  useEffect(() => {
    const handleHashChange = () => {
      const next = getCurrentHashRoute();
      setRoute(next.route);
      setSelectedCollectionId(next.collectionId || null);
      setSelectedListId(next.listId || null);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!loading && !user && !AUTH_ROUTES.has(route)) {
      window.location.hash = '#signin';
    }

    if (!loading && user && route === 'signin') {
      window.location.hash = '#collection';
    }
  }, [route, loading, user]);

  useEffect(() => {
    if (!user) return;
    loadData(user.uid);
    ensurePublicProfile(user.uid, {
      uid: user.uid,
      displayName: (user.email || 'Collector').split('@')[0],
      avatarUrl: '',
      bio: '',
      isPublic: true,
      completionPct: 0,
    }).catch((error) => console.warn('Public profile initialization failed:', error));
  }, [user]);

  useEffect(() => {
    document.body.classList.toggle('light-mode', lightMode);
  }, [lightMode]);

  const afterChange = useCallback(async (updatedStickers, updatedMilestonesSeen) => {
    const ms = updatedMilestonesSeen ?? milestoneSeenRef.current;
    const newToasts = checkMilestones(updatedStickers, ms);

    if (newToasts.length) {
      setToasts(newToasts);
      setMilestonesSeen({ ...ms });
      milestoneSeenRef.current = ms;
      if (newToasts.some((toast) => toast.includes('ALBUM COMPLETE'))) {
        launchConfetti();
      }
    }

    stickersRef.current = updatedStickers;
    milestoneSeenRef.current = ms;
    setStickers([...updatedStickers]);
    await persistData();
  }, [persistData, setMilestonesSeen, setStickers]);

  const handleToggleOwned = useCallback(async (code) => {
    const next = stickersRef.current.map((item) => {
      if (item.code !== code) return item;
      const owned = !item.owned;
      return { ...item, owned, duplicate: owned ? item.duplicate : false, dupCount: owned ? item.dupCount : 0 };
    });
    await afterChange(next);
  }, [afterChange]);

  const handleAddDup = useCallback(async (code) => {
    const item = stickersRef.current.find((entry) => entry.code === code);
    if (!item?.owned) {
      window.appToast?.('Own this card first.');
      return;
    }

    const next = stickersRef.current.map((entry) => entry.code === code
      ? { ...entry, dupCount: (entry.dupCount || 0) + 1, duplicate: true }
      : entry
    );
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData, setStickers]);

  const handleRemoveDup = useCallback(async (code) => {
    const next = stickersRef.current.map((item) => {
      if (item.code !== code) return item;
      const dupCount = Math.max(0, (item.dupCount || 0) - 1);
      return { ...item, dupCount, duplicate: dupCount > 0 };
    });
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData, setStickers]);

  const handleRemoveAllDup = useCallback(async (code) => {
    const next = stickersRef.current.map((item) => item.code === code ? { ...item, dupCount: 0, duplicate: false } : item);
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData, setStickers]);

  const handleToggleWanted = useCallback(async (code) => {
    const next = stickersRef.current.map((item) => item.code === code ? { ...item, wanted: !item.wanted } : item);
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData, setStickers]);

  const handleBulkOwned = useCallback(async (codes) => {
    const codeSet = new Set(codes);
    const next = stickersRef.current.map((item) => codeSet.has(item.code) ? { ...item, owned: true } : item);
    await afterChange(next);
  }, [afterChange]);

  const handleBulkDup = useCallback(async (codes) => {
    const codeSet = new Set(codes);
    const next = stickersRef.current.map((item) => {
      if (!codeSet.has(item.code) || !item.owned) return item;
      return { ...item, dupCount: (item.dupCount || 0) + 1, duplicate: true };
    });
    setStickers([...next]);
    stickersRef.current = next;
    await persistData();
  }, [persistData, setStickers]);

  const handleTradeAccepted = useCallback(async (proposal) => {
    const next = stickersRef.current.map((item) => {
      if (item.code === proposal.giveCode) return { ...item, owned: true };
      if (item.code === proposal.wantCode && item.dupCount > 0) {
        const dupCount = item.dupCount - 1;
        return { ...item, dupCount, duplicate: dupCount > 0 };
      }
      return item;
    });

    const newHistory = [
      ...tradeHistoryRef.current,
      {
        partner: proposal.fromEmail,
        gave: proposal.wantCode,
        gaveName: proposal.wantName || proposal.wantCode,
        got: proposal.giveCode,
        gotName: proposal.giveName || proposal.giveCode,
        date: new Date().toLocaleDateString(),
      },
    ];

    setTradeHistory(newHistory);
    tradeHistoryRef.current = newHistory;
    await afterChange(next);
  }, [afterChange, setTradeHistory]);

  const handleClubClick = useCallback((club) => {
    setClubNavTarget(club);
    setSelectedCollectionId(null);
    setRoute('collection');
    window.location.hash = '#collection';
  }, []);

  const handleSelectCollection = useCallback((collectionId) => {
    setSelectedCollectionId(collectionId);
    setSelectedListId(null);
    setRoute('explore');
    window.location.hash = `#explore/${encodeURIComponent(collectionId)}`;
  }, []);

  const handleBackToCollections = useCallback(() => {
    setSelectedCollectionId(null);
    setRoute('explore');
    window.location.hash = '#explore';
  }, []);

  const handleCreateList = useCallback((name, description = '') => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const nextList = {
      id: `list-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: trimmed,
      description: String(description || '').trim(),
      cardCodes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ownerId: user.uid,
    };
    const next = [...listsRef.current, nextList];
    setLists(next);
    listsRef.current = next;
    persistData();
    return nextList;
  }, [persistData, user]);

  const handleAddCardToList = useCallback((listId, cardCode) => {
    if (!listId || !cardCode) return false;
    const next = listsRef.current.map((list) => {
      if (list.id !== listId) return list;
      const existing = list.cardCodes || [];
      if (existing.includes(cardCode)) return list;
      return {
        ...list,
        cardCodes: [...existing, cardCode],
        updatedAt: new Date().toISOString(),
      };
    });
    setLists(next);
    listsRef.current = next;
    persistData();
    return true;
  }, [persistData]);

  const handleRemoveCardFromList = useCallback((listId, cardCode) => {
    const next = listsRef.current.map((list) => list.id !== listId ? list : {
      ...list,
      cardCodes: (list.cardCodes || []).filter((code) => code !== cardCode),
      updatedAt: new Date().toISOString(),
    });
    setLists(next);
    listsRef.current = next;
    persistData();
  }, [persistData]);

  const handleRenameList = useCallback((listId, name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const next = listsRef.current.map((list) => list.id !== listId ? list : {
      ...list,
      name: trimmed,
      updatedAt: new Date().toISOString(),
    });
    setLists(next);
    listsRef.current = next;
    persistData();
  }, [persistData]);

  const handleDeleteList = useCallback((listId) => {
    const next = listsRef.current.filter((list) => list.id !== listId);
    setLists(next);
    listsRef.current = next;
    if (selectedListId === listId) {
      setSelectedListId(null);
      window.location.hash = '#lists';
    }
    persistData();
  }, [persistData, selectedListId]);

  const handleSyncToCloud = useCallback(async () => {
    try {
      await persistData();
      window.appToast?.('Collection synced to cloud.');
    } catch (error) {
      console.error('Sync failed:', error);
      window.appToast?.('Sync failed: ' + (error?.message || 'unknown error'));
    }
  }, [persistData]);

  const handleSignOut = useCallback(async () => {
    try {
      await logout();
      setMobileNavOpen(false);
      window.location.hash = '#signin';
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }, []);

  if (loading) {
    return <div className="loading-shell"><div className="loading-spinner" /></div>;
  }

  if (!user) {
    if (route === 'register') return <RegisterPage />;
    return <AuthPage />;
  }

  if (!ready) {
    return <div className="loading-shell"><div className="loading-spinner" /></div>;
  }

  const navItems = [
    { id: 'collection', label: 'My Collection' },
    { id: 'explore', label: 'Explore Collections' },
    { id: 'market', label: 'My Market' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'watchlist', label: 'My Watchlist' },
    { id: 'lists', label: 'My Lists' },
    { id: 'trades', label: 'Trades' },
    { id: 'profile', label: 'Profile & Settings' },
  ];

  const renderPage = () => {
    switch (route) {
      case 'explore':
        return (
          <ExploreCollectionsPage
            stickers={stickers}
            lists={lists}
            onToggleOwned={handleToggleOwned}
            onAddCardToList={handleAddCardToList}
            onCreateList={handleCreateList}
            selectedCollectionId={selectedCollectionId}
            onSelectCollection={handleSelectCollection}
            onBackToCollections={handleBackToCollections}
          />
        );
      case 'market':
        return <MarketPage stickers={stickers} lists={lists} onAddCardToList={handleAddCardToList} onCreateList={handleCreateList} />;
      case 'portfolio':
        return <PortfolioPage stickers={stickers} />;
      case 'watchlist':
        return <WatchlistPage stickers={stickers} lists={lists} onAddCardToList={handleAddCardToList} onCreateList={handleCreateList} />;
      case 'lists':
        return (
          <ListsPage
            stickers={stickers}
            lists={lists}
            selectedListId={selectedListId}
            onCreateList={handleCreateList}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
            onAddCardToList={handleAddCardToList}
            onRemoveCardFromList={handleRemoveCardFromList}
            onSelectList={(id) => {
              setSelectedListId(id);
              window.location.hash = `#lists/${encodeURIComponent(id)}`;
            }}
            onBack={() => {
              setSelectedListId(null);
              window.location.hash = '#lists';
            }}
          />
        );
      case 'trades':
        return (
          <TradePage
            stickers={stickers}
            tradeHistory={tradeHistory}
            onTradeAccepted={handleTradeAccepted}
          />
        );
      case 'profile':
        return <ProfilePage user={user} stickers={stickers} />;
      case 'collection':
      default:
        return (
          <>
            <CompactStats stickers={stickers} />
            <CollectionDashboard
              stickers={stickers}
              tradeHistory={tradeHistory}
              onClubClick={handleClubClick}
              onToggleOwned={handleToggleOwned}
              onAddDup={handleAddDup}
              onRemoveDup={handleRemoveDup}
              onBulkOwned={handleBulkOwned}
              onBulkDup={handleBulkDup}
              onRemoveAllDup={handleRemoveAllDup}
              onToggleWanted={handleToggleWanted}
              onTradeAccepted={handleTradeAccepted}
              initialClub={clubNavTarget}
            />
          </>
        );
    }
  };

  const openRoute = (target) => {
    setRoute(target);
    setSelectedCollectionId(null);
    setSelectedListId(null);
    setMobileNavOpen(false);
    if (target === 'explore') window.location.hash = '#explore';
    else if (target === 'lists') window.location.hash = '#lists';
    else window.location.hash = `#${target}`;
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark">C</div>
          <div>
            <p className="eyebrow">Premium service</p>
            <h2>Collexo</h2>
          </div>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={route === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => openRoute(item.id)}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="secondary-button" onClick={() => setLightMode((value) => !value)}>
            {lightMode ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" className="signout-button" onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label="Toggle navigation"
            onClick={() => setMobileNavOpen((value) => !value)}
          >
            ☰
          </button>

          <div className="topbar-copy">
            <p className="eyebrow">Dashboard</p>
            <h1>{navItems.find((item) => item.id === route)?.label || 'My Collection'}</h1>
          </div>

          <div className="topbar-actions">
            <button type="button" className="secondary-button" onClick={handleSyncToCloud}>Sync</button>
            <button type="button" className="primary-button small-button" onClick={() => openRoute('explore')}>Add cards</button>
          </div>
        </header>

        <div className="content-area">{renderPage()}</div>
      </main>

      <MilestoneToast messages={toasts} onDone={() => setToasts([])} />
    </div>
  );
}
