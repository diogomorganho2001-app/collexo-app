import { useState, useCallback, useRef } from 'react';
import { loadUserData, saveUserData } from '../services/collections.js';
import defaultStickers from '../../stickers.json';

function buildInitialStickers(saved) {
  // If no saved data, just use defaults
  if (!saved) {
    return defaultStickers.map(s => ({
      ...s,
      owned:     s.owned     || false,
      dupCount:  s.dupCount  !== undefined ? s.dupCount : (s.duplicate ? 1 : 0),
      duplicate: s.dupCount  > 0 || s.duplicate || false,
      wanted:    s.wanted    || false,
    }));
  }

  // Migration: correct corrupted codes by matching on name + team
  // Build a lookup map from stickers.json
  const codeMap = {}; // Map (name|team) -> correct code
  defaultStickers.forEach(s => {
    const key = `${s.name}|${s.team}`;
    codeMap[key] = s.code;
  });

  const result = [];
  const seenCodes = new Set();

  // Process saved stickers: match by name+team to get correct code
  saved.forEach(s => {
    const key = `${s.name}|${s.team}`;
    const correctCode = codeMap[key];

    // If we found a match in stickers.json, use the correct code and keep user data
    if (correctCode && !seenCodes.has(correctCode)) {
      seenCodes.add(correctCode);
      result.push({
        code:      correctCode,
        name:      s.name,
        team:      s.team,
        owned:     s.owned || false,
        dupCount:  s.dupCount !== undefined ? s.dupCount : (s.duplicate ? 1 : 0),
        duplicate: s.dupCount > 0 || s.duplicate || false,
        wanted:    s.wanted || false,
      });
    }
    // If no match found, skip this sticker (corrupted or no longer in catalog)
  });

  // Add any stickers from stickers.json that weren't in the saved data
  defaultStickers.forEach(s => {
    if (!seenCodes.has(s.code)) {
      result.push({
        code:      s.code,
        name:      s.name,
        team:      s.team,
        owned:     false,
        dupCount:  0,
        duplicate: false,
        wanted:    false,
      });
    }
  });

  return result;
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
