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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // back camera on mobile, falls back on desktop
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        const vid = videoRef.current;
        vid.srcObject = stream;
        vid.muted = true;
        // Wait for metadata so videoWidth/videoHeight are available before capture
        await new Promise(resolve => {
          if (vid.readyState >= 1) { resolve(); return; }
          vid.onloadedmetadata = resolve;
        });
        try { await vid.play(); } catch (e) {}
      }
      setCameraActive(true);
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError('Camera access was denied or is unavailable: ' + error.message);
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
    const video = videoRef.current;

    // Guard: if the stream hasn't started rendering yet, dimensions are 0
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera not ready yet — wait a moment and try again.');
      return;
    }

    setOcrStatus('Scanning…');
    try {
      const fullW = video.videoWidth;
      const fullH = video.videoHeight;

      // The sticker code (e.g. "ARG 2") is in the TOP ~30% of the sticker.
      // Crop to that region so Tesseract ignores the noisy copyright text below.
      const cropH = Math.floor(fullH * 0.30);
      const canvas = document.createElement('canvas');
      canvas.width  = fullW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, fullW, cropH, 0, 0, fullW, cropH);

      const { createWorker } = await import('tesseract.js');
      // Tesseract.js v4 API: language passed directly to createWorker
      const worker = await createWorker('eng');
      await worker.setParameters({
        // Only recognise uppercase letters, digits and spaces — matches sticker codes
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
        tessedit_pageseg_mode: '7', // treat image as a single text line
      });
      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      const raw = data.text.trim();
      setOcrStatus(`OCR: "${raw}"`);
      applyScanText(raw);
    } catch (error) {
      console.error('OCR error:', error);
      setCameraError('Scan failed: ' + error.message + '. Try entering the code manually.');
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
            <video ref={videoRef} autoPlay muted playsInline webkit-playsinline="true" className="camera-video" style={{ width: '100%', maxHeight: 320, background: '#000', display: 'block' }} />
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