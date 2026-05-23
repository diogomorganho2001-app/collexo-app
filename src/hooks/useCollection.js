import { useState, useCallback, useRef } from 'react';
import { loadUserData, saveUserData } from '../services/collections.js';
import defaultStickers from '../../stickers.json';

function buildInitialStickers(saved) {
  return (saved || defaultStickers).map(s => ({
    ...s,
    owned:     s.owned     || false,
    dupCount:  s.dupCount  !== undefined ? s.dupCount : (s.duplicate ? 1 : 0),
    duplicate: s.dupCount  > 0 || s.duplicate || false,
    wanted:   s.wanted   || false,
  }));
}

/**
 * Manages the sticker collection state for a signed-in user.
 *
 * Returns:
 *  stickers, tradeHistory, milestonesSeen,
 *  setStickers, setTradeHistory, setMilestonesSeen,
 *  loadData(uid), persistData()
 */
export function useCollection(user) {
  const [stickers,       setStickers]       = useState([]);
  const [tradeHistory,   setTradeHistory]   = useState([]);
  const [milestonesSeen, setMilestonesSeen] = useState({});
  const [ready,          setReady]          = useState(false);

  // Keep a ref so callbacks always have fresh values without re-creating them
  const stickersRef       = useRef(stickers);
  const tradeHistoryRef   = useRef(tradeHistory);
  const milestoneSeenRef  = useRef(milestonesSeen);
  stickersRef.current      = stickers;
  tradeHistoryRef.current  = tradeHistory;
  milestoneSeenRef.current = milestonesSeen;

  const loadData = useCallback(async (uid) => {
    const data = await loadUserData(uid);
    if (data) {
      const s  = buildInitialStickers(data.stickers);
      const th = data.tradeHistory   || [];
      const ms = data.milestonesSeen || {};
      setStickers(s);
      setTradeHistory(th);
      setMilestonesSeen(ms);
      stickersRef.current      = s;
      tradeHistoryRef.current  = th;
      milestoneSeenRef.current = ms;
      // Backfill email if missing
      if (!data.email && user) {
        await saveUserData(uid, user.email, s, th, ms);
      }
    } else {
      const s = buildInitialStickers(null);
      setStickers(s);
      setTradeHistory([]);
      setMilestonesSeen({});
      stickersRef.current = s;
      await saveUserData(uid, user?.email || '', s, [], {});
    }
    setReady(true);
  }, [user]);

  const persistData = useCallback(async () => {
    if (!user) return;
    await saveUserData(
      user.uid,
      user.email,
      stickersRef.current,
      tradeHistoryRef.current,
      milestoneSeenRef.current,
    );
  }, [user]);

  return {
    stickers, setStickers,
    tradeHistory, setTradeHistory,
    milestonesSeen, setMilestonesSeen,
    loadData, persistData, ready,
    // Expose refs for use in callbacks that need latest values
    stickersRef, tradeHistoryRef, milestoneSeenRef,
  };
}
