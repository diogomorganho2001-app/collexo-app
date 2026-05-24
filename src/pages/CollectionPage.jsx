import React, { useState, useMemo, useEffect, useRef } from 'react';

export default function CollectionPage({ stickers, onToggleOwned, onAddDup, onRemoveDup, onBulkOwned, onBulkDup, onToggleWanted, initialTeam }) {
  const [search,       setSearch]       = useState('');
  const [teamFilter,   setTeamFilter]   = useState(initialTeam || '');
  const [statusFilter, setStatusFilter] = useState('');
  const [bulkMode,     setBulkMode]     = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [scanCode,     setScanCode]     = useState('');
  const [scanFeedback, setScanFeedback] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError,  setCameraError]  = useState('');
  const [ocrStatus,    setOcrStatus]    = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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

  function stopCamera() {
    setCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (e) {}
      try { videoRef.current.srcObject = null; } catch (e) {}
    }
  }

  async function openCamera() {
    setCameraError('');
    setOcrStatus('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (e) {}
      }
      setCameraActive(true);
    } catch (error) {
      setCameraError('Camera access was denied or is unavailable.');
    }
  }

  function applyScanText(rawText) {
    const normalized = (rawText || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!normalized) {
      setScanFeedback('Could not read any sticker text. Try again.');
      return;
    }

    const direct = stickers.find(s => s.code.toUpperCase() === normalized);
    if (direct) {
      if (!direct.owned) {
        onToggleOwned(direct.code);
        setScanFeedback(`Matched ${direct.code}: marked as owned.`);
      } else {
        onAddDup(direct.code);
        setScanFeedback(`Matched ${direct.code}: already owned, added duplicate.`);
      }
      setScanCode('');
      return;
    }

    const match = normalized.match(/([A-Z]{3})\s+(\d{1,2})/);
    if (match) {
      const code = `${match[1]} ${parseInt(match[2], 10)}`;
      const found = stickers.find(s => s.code.toUpperCase() === code);
      if (found) {
        if (!found.owned) {
          onToggleOwned(found.code);
          setScanFeedback(`Detected ${normalized}, marked ${found.code} as owned.`);
        } else {
          onAddDup(found.code);
          setScanFeedback(`Detected ${normalized}, added ${found.code} as duplicate.`);
        }
        setScanCode('');
        return;
      }
    }

    setScanFeedback(`Could not identify sticker from “${normalized}”. Use code like ALG 1 or try a clearer photo.`);
  }

  async function handleScanAction() {
    // If user typed a code, treat that as the scan action
    const code = scanCode.trim().toUpperCase();
    if (code) {
      applyScanText(code);
      return;
    }

    // Otherwise, use the camera: if closed -> open, if open -> capture
    if (!cameraActive) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await openCamera();
      } else {
        setCameraError('Camera not available on this device.');
      }
      return;
    }

    // camera is active -> capture frame
    await captureFrame();
    // stop camera after capture to avoid lingering black screens
    stopCamera();
  }

  async function captureFrame() {
    if (!videoRef.current) return;
    setOcrStatus('Scanning image…');
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker({ logger: () => null });
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      setOcrStatus(`OCR result: ${data.text.trim()}`);
      applyScanText(data.text);
    } catch (error) {
      console.error(error);
      setCameraError('Image scan failed. Try again or enter the code manually.');
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
        <div className="scan-group">
          <input
            placeholder="Scan code"
            value={scanCode}
            onChange={e => setScanCode(e.target.value)}
          />
          <button className="btn-bulk" onClick={handleScanAction}>{cameraActive ? 'Capture' : 'Scan'}</button>
        </div>
        <button
          className="btn-bulk"
          style={{ background: bulkMode ? 'rgba(240,180,41,.3)' : 'rgba(240,180,41,.1)' }}
          onClick={() => { setBulkMode(b => !b); setSelected(new Set()); }}
        >
          ☑️ Bulk
        </button>
      </div>
      {scanFeedback && (
        <div className="scan-feedback">{scanFeedback}</div>
      )}
      {cameraError && (
        <div className="scan-feedback" style={{ color: 'var(--red)' }}>{cameraError}</div>
      )}
      {ocrStatus && (
        <div className="scan-feedback">{ocrStatus}</div>
      )}
      {cameraActive && (
        <div className="camera-overlay">
          <div className="camera-panel">
            <video ref={videoRef} autoPlay muted playsInline className="camera-video" />
            <div className="camera-actions">
              <button className="btn-bulk" onClick={captureFrame}>Capture</button>
              <button className="btn-bulk-cancel" onClick={stopCamera}>Close</button>
            </div>
          </div>
        </div>
      )}

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
                      onClick={() => onToggleWanted?.(sticker.code)}
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
