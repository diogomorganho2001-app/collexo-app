import React from 'react';
import { exportDuplicates, exportMissing } from '../utils/export.js';

export default function DuplicatesPage({ stickers, onRemoveAllDup }) {
  const repeated = stickers.filter(s => s.duplicate && s.dupCount > 0);

  return (
    <section id="duplicatesPage">
      <div className="dup-export-bar">
        <button className="btn-export" onClick={() => exportDuplicates(stickers)}>
          📤 Share Duplicates
        </button>
        <button className="btn-export" onClick={() => exportMissing(stickers)}>
          📋 Share Missing
        </button>
      </div>

      <div className="badge-grid">
        {repeated.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: '20px 0 0' }}>
            No repeated stickers yet. Mark duplicates from the Collection tab.
          </p>
        ) : (
          repeated.map(sticker => (
            <div key={sticker.code} className="badge">
              <span>{sticker.code} · {sticker.name}</span>
              <span className="dup-count-display">×{sticker.dupCount}</span>
              <button
                className="remove-dup"
                onClick={() => onRemoveAllDup(sticker.code)}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
