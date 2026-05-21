import React from 'react';

export default function CompactStats({ stickers }) {
  const owned      = stickers.filter(s => s.owned).length;
  const missing    = stickers.length - owned;
  const duplicates = stickers.filter(s => s.duplicate).length;
  const percent    = stickers.length ? Math.floor((owned / stickers.length) * 100) : 0;

  return (
    <div id="compactStats">
      <div className="cs-item">
        <span className="cs-val">{owned}</span>
        <span className="cs-lbl">Owned</span>
      </div>
      <div className="cs-item">
        <span className="cs-val">{missing}</span>
        <span className="cs-lbl">Missing</span>
      </div>
      <div className="cs-item">
        <span className="cs-val">{duplicates}</span>
        <span className="cs-lbl">Repeated</span>
      </div>
      <div className="cs-item">
        <span className="cs-val">{percent}%</span>
        <span className="cs-lbl">Complete</span>
      </div>
    </div>
  );
}
