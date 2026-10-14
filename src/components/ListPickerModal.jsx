import React, { useMemo, useState } from 'react';

export default function ListPickerModal({ isOpen, lists = [], card, onClose, onAddToList, onCreateList }) {
  const [draftName, setDraftName] = useState('');

  const safeListName = useMemo(() => {
    if (!card) return 'this card';
    return `${card.name || 'Card'} (${card.team || 'collection'})`;
  }, [card]);

  if (!isOpen || !card) return null;

  const handleCreate = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    if (typeof onCreateList === 'function') {
      const list = onCreateList(trimmed, `Custom list for ${safeListName}`);
      if (list && typeof onAddToList === 'function') {
        onAddToList(list.id, card.code);
      }
    }
    setDraftName('');
    onClose?.();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header row-between">
          <div>
            <p className="eyebrow">Add card</p>
            <h3>{card.name || 'Card'}</h3>
          </div>
          <button type="button" className="secondary-button small-button" onClick={onClose}>Close</button>
        </div>

        <div className="modal-actions vertical-stack">
          {lists.length === 0 ? (
            <p className="muted">No lists yet. Create one below.</p>
          ) : (
            lists.map((list) => (
              <button
                key={list.id}
                type="button"
                className="secondary-button list-picker-button"
                onClick={() => {
                  onAddToList?.(list.id, card.code);
                  onClose?.();
                }}
              >
                {list.name}
              </button>
            ))
          )}

          <div className="field-group">
            <label htmlFor="list-name-input">Create new list</label>
            <input
              id="list-name-input"
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="e.g. Rising Stars"
            />
          </div>
          <button type="button" className="primary-button" onClick={handleCreate}>Create and add</button>
        </div>
      </div>
    </div>
  );
}
