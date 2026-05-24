import React, { useState, useEffect, useRef } from 'react';
import {
  findUserByEmail,
  searchUsersByEmail,
  getUserCollection,
  sendProposal,
  loadIncomingProposals,
  getProposalById,
  respondToProposal,
  createChatRoomForProposal,
  loadChatRooms,
  loadChatMessages,
  sendChatMessage,
  publishToBoard,
  fetchPublicBoard,
  loadAllTradeHistory,
} from '../services/trades.js';
import { auth } from '../services/firebase.js';

/* ─────────────────────────────────────── */
/*  FIND sub-tab                           */
/* ─────────────────────────────────────── */
function FindTab({ stickers }) {
  const [email,            setEmail]            = useState('');
  const [searchResults,    setSearchResults]    = useState([]);
  const [status,           setStatus]           = useState(null);
  const [resultInfo,       setResultInfo]       = useState(null);
  const [canGet,           setCanGet]           = useState([]);
  const [theirStickers,    setTheirStickers]    = useState(null);
  const [showingStickers,  setShowingStickers]  = useState(false);
  const [selectedCard,     setSelectedCard]     = useState(null);
  const [offerCode,        setOfferCode]        = useState('');
  const [offerSearch,      setOfferSearch]      = useState('');
  const [dropdownOpen,     setDropdownOpen]     = useState(false);
  const [requestStatus,    setRequestStatus]    = useState(null);
  const [interestMessage,  setInterestMessage]  = useState('Hey I want this card, can you check my list and see if there is any of your interest?');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleEmailSearch(value) {
    setEmail(value);
    if (value.length < 2) {
      setSearchResults([]);
    } else {
      const results = await searchUsersByEmail(value);
      setSearchResults(results);
    }
  }

  async function selectUser(selectedEmail) {
    setEmail(selectedEmail);
    setSearchResults([]);
    setShowingStickers(false);
    setSelectedCard(null);
    setOfferCode('');
    setOfferSearch('');
    await checkTrade(selectedEmail);
  }

  async function selectCard(card) {
    setSelectedCard(card);
    setOfferCode('');
    setOfferSearch('');
    setRequestStatus(null);
    setDropdownOpen(false);
    if (!theirStickers || theirStickers.email !== email) {
      await viewTheirStickers();
    }
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

  async function sendOfferToFriend() {
    if (!selectedCard) return;
    if (!offerCode) { setRequestStatus({ type: 'error', msg: 'Pick a card to offer first.' }); return; }
    try {
      const found = await findUserByEmail(email);
      if (!found) { setRequestStatus({ type: 'error', msg: 'Friend not found.' }); return; }
      const offer = stickers.find(s => s.code === offerCode);
      await sendProposal({
        fromEmail: auth.currentUser.email,
        fromUid: auth.currentUser.uid,
        fromUserId: auth.currentUser.uid,
        toEmail: email,
        toUid: found.uid,
        toUserId: found.uid,
        giveCode: offer?.code,
        giveName: offer?.name,
        giveTeam: offer?.team,
        wantCode: selectedCard.code,
        wantName: selectedCard.name,
        wantTeam: selectedCard.team,
        message: `I want ${selectedCard.code}. I can offer ${offer?.code}.`,
        requestType: 'proposal',
      });
      setRequestStatus({ type: 'success', msg: `✅ Proposal sent for ${selectedCard.code}!` });
      setOfferCode('');
      setOfferSearch('');
    } catch (err) {
      setRequestStatus({ type: 'error', msg: err.message });
    }
  }

  async function sendInterestRequest() {
    if (!selectedCard) return;
    try {
      const found = await findUserByEmail(email);
      if (!found) { setRequestStatus({ type: 'error', msg: 'Friend not found.' }); return; }
      const myWishList = stickers
        .filter(s => s.wanted)
        .map(s => ({ code: s.code, name: s.name, team: s.team }));
      await sendProposal({
        fromEmail: auth.currentUser.email,
        fromUid: auth.currentUser.uid,
        fromUserId: auth.currentUser.uid,
        toEmail: email,
        toUid: found.uid,
        toUserId: found.uid,
        giveCode: offerCode || '',
        giveName: offerCode ? stickers.find(s => s.code === offerCode)?.name || '' : '',
        giveTeam: offerCode ? stickers.find(s => s.code === offerCode)?.team || '' : '',
        wantCode: selectedCard.code,
        wantName: selectedCard.name,
        wantTeam: selectedCard.team,
        message: interestMessage,
        requestType: 'interest',
        attachedWantList: myWishList,
      });
      setRequestStatus({ type: 'success', msg: `✅ Interest request sent for ${selectedCard.code}!` });
      setOfferCode('');
      setOfferSearch('');
    } catch (err) {
      setRequestStatus({ type: 'error', msg: err.message });
    }
  }

  const myDups = stickers.filter(s => s.duplicate && s.dupCount > 0);
  const friendWantList = theirStickers?.stickers.filter(s => s.wanted) || [];
  const friendWantCodes = new Set(friendWantList.map(s => s.code));

  // Filtered duplicates for the searchable dropdown
  const filteredMyDups = myDups.filter(s =>
    !offerSearch ||
    s.code.toLowerCase().includes(offerSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(offerSearch.toLowerCase()) ||
    s.team.toLowerCase().includes(offerSearch.toLowerCase())
  );

  const selectedOfferSticker = myDups.find(s => s.code === offerCode);

  // When clicking a wish-list item: auto-select matching duplicate if we have it
  function handleWishListClick(wishItem) {
    const myMatchingDup = myDups.find(s => s.code === wishItem.code);
    if (myMatchingDup) {
      setOfferCode(myMatchingDup.code);
      setOfferSearch(myMatchingDup.code + ' – ' + myMatchingDup.name);
    }
  }

  return (
    <div className="trade-section">
      <div className="trade-find-form">
        <h3>Find trade partner</h3>
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
            View Partner Collection
          </button>
        </div>
      )}

      {resultInfo && !showingStickers && (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--muted)' }}>
            Click a duplicate card to select it for trade.
          </div>
          <div className="trade-need-grid">
            {canGet.length === 0 ? (
              <div className="trade-empty">
                <span className="te-icon">🎉</span>
                You already have all their duplicates!
              </div>
            ) : (
              canGet.map(s => (
                <button
                  key={s.code}
                  type="button"
                  className={`trade-need-badge${selectedCard?.code === s.code ? ' selected' : ''}`}
                  onClick={() => selectCard(s)}
                >
                  <span className="tnb-code">{s.code}</span>
                  <span className="tnb-name">{s.name}</span>
                  <span className="tnb-team">{s.team}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {selectedCard && (
        <div className="trade-selected-panel">
          <div className="trade-selected-header">
            <h4>Selected target sticker</h4>
            <div>
              <strong>{selectedCard.code}</strong> — {selectedCard.name} ({selectedCard.team})
            </div>
          </div>

          <div className="trade-panel-block">
            {/* Their wish list */}
            <div>
              <div className="trade-panel-title">Their wish list</div>
              {friendWantList.length === 0 ? (
                <div className="trade-empty">They haven't marked any wants yet.</div>
              ) : (
                <div className="trade-need-grid">
                  {friendWantList.map(s => {
                    const iHaveIt = myDups.some(d => d.code === s.code);
                    return (
                      <div
                        key={s.code}
                        className={`trade-need-badge small${iHaveIt ? ' match-highlight' : ''}`}
                        style={iHaveIt ? { cursor: 'pointer', border: '2px solid var(--green)' } : {}}
                        onClick={() => iHaveIt && handleWishListClick(s)}
                        title={iHaveIt ? 'You have this duplicate! Click to auto-select it.' : ''}
                      >
                        <span className="tnb-code">{s.code}</span>
                        <span className="tnb-name">{s.name}</span>
                        {iHaveIt && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>✓ You have it</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Your duplicates — searchable dropdown */}
            <div>
              <div className="trade-panel-title">Your duplicates</div>
              {myDups.length === 0 ? (
                <div className="trade-empty">You have no duplicates available to offer.</div>
              ) : (
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search your duplicates (code, name, team)…"
                    value={offerSearch}
                    onChange={e => {
                      setOfferSearch(e.target.value);
                      setOfferCode('');
                      setDropdownOpen(true);
                    }}
                    onFocus={() => setDropdownOpen(true)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {dropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      maxHeight: 220,
                      overflowY: 'auto',
                      zIndex: 200,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                      {filteredMyDups.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)' }}>No duplicates match.</div>
                      ) : (
                        filteredMyDups.map(s => (
                          <div
                            key={s.code}
                            onClick={() => {
                              setOfferCode(s.code);
                              setOfferSearch(s.code + ' – ' + s.name);
                              setDropdownOpen(false);
                            }}
                            style={{
                              padding: '9px 12px',
                              borderBottom: '1px solid var(--border)',
                              cursor: 'pointer',
                              fontSize: 13,
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              background: offerCode === s.code ? 'var(--background)' : 'transparent'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--background)'}
                            onMouseOut={e => e.currentTarget.style.background = offerCode === s.code ? 'var(--background)' : 'transparent'}
                          >
                            <span style={{ fontWeight: 700, minWidth: 48 }}>{s.code}</span>
                            <span style={{ flex: 1 }}>{s.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.team}</span>
                            {s.dupCount > 1 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>×{s.dupCount}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {selectedOfferSticker && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      background: 'var(--background)',
                      borderRadius: 4,
                      fontSize: 13,
                      borderLeft: '3px solid var(--primary)',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center'
                    }}>
                      <span>🃏 Offering:</span>
                      <strong>{selectedOfferSticker.code}</strong>
                      <span>{selectedOfferSticker.name}</span>
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>{selectedOfferSticker.team}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

              <div className="trade-panel-actions">
            <button className="btn-send-proposal" onClick={sendOfferToFriend} disabled={!offerCode}>
              Propose Trade
            </button>
            <button className="btn-contact" onClick={sendInterestRequest}>
              Send Interest Request
            </button>
          </div>

          <div className="trade-panel-message">
            <label>Message</label>
            <textarea
              value={interestMessage}
              onChange={e => setInterestMessage(e.target.value)}
              rows={3}
            />
          </div>

          {requestStatus && (
            <div className={`trade-status ${requestStatus.type}`} style={{ marginTop: 12 }}>
              {requestStatus.msg}
            </div>
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
/*  Incoming Proposals (shared component) */
/* ─────────────────────────────────────── */
function IncomingProposals({ stickers, onTradeAccepted }) {
  const [proposals, setProposals] = useState(null);
  const [chatCreateError, setChatCreateError] = useState(null);
  const [proposalError, setProposalError] = useState(null);

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
    const uid = auth.currentUser?.uid;
    if (!uid) { alert('You must be signed in to respond.'); return; }

    // Step 1: update proposal status
    try {
      await respondToProposal(propId, action);
    } catch (respErr) {
      console.error('Proposal update failed:', respErr);
      alert(`Proposal update failed: ${respErr?.message || respErr}`);
      return;
    }

    // Step 2: if accepted, create the chat room
    if (action === 'accept') {
      try {
        await createChatRoomForProposal(p);
        onTradeAccepted?.(p);
        alert('✅ Trade accepted! Go to the Chats tab to coordinate.');
      } catch (chatErr) {
        console.error('Chat room creation failed:', chatErr);
        // Trade was accepted but chat failed — tell the user exactly why
        alert(`Trade accepted ✅, but chat creation failed: ${chatErr?.message || chatErr}

Check the browser console for details.`);
      }
    } else {
      alert('Trade declined.');
    }
    load();
  }

  if (proposals === null) return <div className="trade-empty"><span className="te-icon">⏳</span>Loading…</div>;

  return (
    <>
      <div style={{ marginTop: 16 }}>
        <div className="section-title" style={{ padding: '0 0 8px 0' }}>
          Incoming requests
          {proposals.length > 0 && (
            <span style={{
              marginLeft: 8,
              background: 'var(--red)',
              color: '#fff',
              borderRadius: 99,
              fontSize: 11,
              padding: '2px 8px',
              fontWeight: 700
            }}>{proposals.length}</span>
          )}
        </div>
      </div>
      <div className="proposals-list">
        {proposalError && (
          <div className="proposal-error-card">
            <strong>Proposal update failed:</strong> {proposalError.message} {proposalError.code ? `(${proposalError.code})` : ''}
            <div style={{ marginTop: 8 }}>
              <button className="btn-bulk" onClick={async () => {
                try {
                  // retry the same accept action
                  const p = proposals.find(x => x.id === proposalError.proposalId);
                  if (!p) throw new Error('Proposal not found');
                  await respond(p.id, 'accept', p);
                  setProposalError(null);
                } catch (err) {
                  alert('Retry failed: ' + err.message);
                }
              }}>Retry accept</button>
            </div>
          </div>
        )}
        {chatCreateError && (
          <div className="proposal-error-card">
            <strong>Chat creation failed:</strong> {chatCreateError.message}
            <div style={{ marginTop: 8 }}>
              <button className="btn-bulk" onClick={async () => {
                // retry once from UI
                try {
                  const p = proposals.find(x => x.id === chatCreateError.proposalId);
                  if (!p) throw new Error('Proposal not found');
                  await createChatRoomForProposal(p);
                  setChatCreateError(null);
                  await load();
                } catch (err) {
                  alert('Retry failed: ' + err.message);
                }
              }}>Retry chat creation</button>
            </div>
          </div>
        )}
        {proposals.length === 0 ? (
          <div className="trade-empty"><span className="te-icon">✉️</span>No incoming proposals</div>
        ) : (
          proposals.map(p => (
            <div key={p.id} className="proposal-card">
              <div className="pc-header">
                <span className="pc-from">From: <strong>{p.fromEmail}</strong></span>
                <span className="pc-badge">⏳ Pending</span>
              </div>
              <div className="pc-swap">
                {p.requestType === 'interest' ? (
                  <>They're interested in: <strong style={{ color: 'var(--red)' }}>{p.wantCode} – {p.wantName}</strong></>
                ) : (
                  <>
                    They give: <strong style={{ color: 'var(--green)' }}>{p.giveCode} – {p.giveName}</strong><br />
                    They want: <strong style={{ color: 'var(--red)' }}>{p.wantCode} – {p.wantName}</strong>
                  </>
                )}
              </div>
              {p.message && (
                <div className="pc-message">
                  <strong>Message:</strong> {p.message}
                </div>
              )}
              {p.attachedWantList?.length > 0 && (
                <div className="pc-attachment">
                  <div style={{ fontSize: 12, marginBottom: 6 }}>📌 Their want list:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.attachedWantList.map(item => (
                      <span key={item.code} className="board-dup-chip">{item.code}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="pc-actions">
                {p.requestType !== 'interest' && (
                  <button className="btn-accept" onClick={() => respond(p.id, 'accept', p)}>Accept</button>
                )}
                <button className="btn-reject" onClick={() => respond(p.id, 'reject', p)}>Decline</button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function ChatTab() {
  const [rooms, setRooms] = useState(null);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  async function loadRooms() {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const list = await loadChatRooms(auth.currentUser.uid);
      setRooms(list);
      if (list.length && !activeRoom) {
        setActiveRoom(list[0]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadMessagesForRoom(room) {
    if (!room) {
      setMessages([]);
      return;
    }
    try {
      const msgs = await loadChatMessages(room.id);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load chat messages', err);
      setMessages([]);
    }
  }

  useEffect(() => { loadRooms(); }, []);
  useEffect(() => { loadMessagesForRoom(activeRoom); }, [activeRoom]);

  async function handleSend() {
    if (!activeRoom || !newMessage.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(activeRoom.id, auth.currentUser.uid, auth.currentUser.email, newMessage);
      setNewMessage('');
      await loadMessagesForRoom(activeRoom);
      await loadRooms();
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  }

  function getPartnerEmail(room) {
    return room?.participantEmails?.find(email => email !== auth.currentUser.email) || room?.participantEmails?.[0] || 'Partner';
  }

  function formatDisplayName(email) {
    if (!email) return 'Partner';
    return email.includes('@') ? email.split('@')[0] : email;
  }

  function formatRoomType(type) {
    if (type === 'interest') return 'Interest request';
    if (type === 'proposal') return 'Trade chat';
    return `${type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Trade'} chat`;
  }

  const partnerEmail = getPartnerEmail(activeRoom);
  const partnerName = formatDisplayName(partnerEmail);
  const roomLabel = activeRoom ? `${partnerName} · ${formatRoomType(activeRoom.tradeType)}` : '';

  return (
    <div className="trade-section">
      <div className="chat-layout">
        <div className="chat-rooms-panel">
          <div className="section-title">Chats</div>
          {loading && <div className="trade-empty">Loading chats…</div>}
          {!loading && rooms?.length === 0 && (
            <div className="trade-empty">No active chats yet. Accept a trade to start a conversation.</div>
          )}
          {!loading && rooms?.length > 0 && (
            <div className="chat-room-list">
              {rooms.map(room => {
                const partnerEmail = getPartnerEmail(room);
                const partnerName = formatDisplayName(partnerEmail);
                const roomType = formatRoomType(room.tradeType);
                return (
                  <button
                    key={room.id}
                    type="button"
                    className={activeRoom?.id === room.id ? 'chat-room-item active' : 'chat-room-item'}
                    onClick={() => setActiveRoom(room)}
                  >
                    <div className="chat-room-title">{roomType} · {partnerName}</div>
                    <div className="chat-room-subtitle">{room.lastMessage || 'No messages yet'}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="chat-thread-panel">
          {!activeRoom ? (
            <div className="trade-empty">Select a chat to continue the conversation.</div>
          ) : (
            <>
              <div className="chat-thread-header">
                <div>
                  <div className="chat-thread-title">{roomLabel}</div>
                  <div className="chat-thread-meta">Trade ID: {activeRoom.tradeId}</div>
                </div>
              </div>
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="trade-empty">No messages yet. Send the first note.</div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={msg.senderId === auth.currentUser.uid ? 'chat-message mine' : 'chat-message'}
                    >
                      <div className="chat-message-body">{msg.text}</div>
                      <div className="chat-message-meta">{msg.senderEmail}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="chat-input-row">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Write a message to coordinate the trade..."
                  rows={3}
                />
                <button className="btn-send-proposal" onClick={handleSend} disabled={sending || !newMessage.trim()}>
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────── */
/*  BOARD sub-tab                          */
/* ─────────────────────────────────────── */
function BoardTab({ stickers }) {
  const [board, setBoard] = useState(null);
  const [publishMessage, setPublishMessage] = useState('');

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
    if (!dups.length) { setPublishMessage('You have no duplicates to publish.'); return; }
    const missing = stickers.filter(s => !s.owned).slice(0, 20);
    try {
      await publishToBoard(
        auth.currentUser.email,
        auth.currentUser.uid,
        dups.map(s => ({ code: s.code, name: s.name, team: s.team, qty: s.dupCount })),
        missing.map(s => ({ code: s.code, name: s.name })),
      );
      setPublishMessage('✅ Your duplicates are now on the public trade board!');
      load();
      window.setTimeout(() => setPublishMessage(''), 3000);
    } catch (e) {
      setPublishMessage('Error: ' + e.message);
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
      {publishMessage && (
        <div className="board-publish-toast">{publishMessage}</div>
      )}

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
function HistoryTab() {
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
        {allTrades === null ? (
          <div className="trade-empty"><span className="te-icon">⏳</span>Loading…</div>
        ) : trades.length === 0 ? (
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
    { id: 'find',    label: 'Find'    },
    { id: 'inbox',   label: 'Inbox'   },
    { id: 'chat',    label: 'Chats'   },
    { id: 'board',   label: 'Board'   },
    { id: 'history', label: 'History' },
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

      {activeTab === 'find'    && <FindTab stickers={stickers} />}
      {activeTab === 'inbox'   && (
        <div className="trade-section">
          <IncomingProposals stickers={stickers} onTradeAccepted={onTradeAccepted} />
        </div>
      )}
      {activeTab === 'chat'    && <ChatTab />}
      {activeTab === 'board'   && <BoardTab stickers={stickers} />}
      {activeTab === 'history' && <HistoryTab />}
    </section>
  );
}