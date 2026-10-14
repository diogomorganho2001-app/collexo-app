import React, { useMemo, useState } from 'react';
import { getCatalogueItemByCode } from '../services/catalogue.js';

function resolveListCard(code, stickers = []) {
  return stickers.find((item) => item.code === code) || getCatalogueItemByCode(code) || { code, name: code, team: 'Unknown team' };
}

export default function ListsPage({
  stickers = [],
  lists = [],
  selectedListId = null,
  onCreateList,
  onRenameList,
  onDeleteList,
  onRemoveCardFromList,
  onSelectList,
  onBack,
}) {
  const [draftName, setDraftName] = useState('');

  const selectedList = useMemo(
    () => lists.find((list) => list.id === selectedListId) || null,
    [lists, selectedListId],
  );

  const selectedCards = useMemo(() => {
    if (!selectedList) return [];
    const codes = Array.from(new Set(selectedList.cardCodes || []));
    return codes.map((code) => resolveListCard(code, stickers)).filter(Boolean);
  }, [selectedList, stickers]);

  const handleCreate = () => {
    const trimmed = String(draftName || '').trim();
    if (!trimmed || typeof onCreateList !== 'function') return;
    onCreateList(trimmed, '');
    setDraftName('');
  };

  if (selectedList) {
    return (
      <div className="page-shell">
        <div className="page-header row-between">
          <div>
            <p className="eyebrow">My Lists</p>
            <h1>{selectedList.name}</h1>
          </div>
          <div className="inline-actions">
            <button type="button" className="secondary-button small-button" onClick={() => {
              const nextName = window.prompt('Rename this list', selectedList.name);
              if (nextName && typeof onRenameList === 'function') onRenameList(selectedList.id, nextName);
            }}>Rename</button>
            <button type="button" className="secondary-button small-button" onClick={() => {
              if (window.confirm('Delete this list?')) onDeleteList?.(selectedList.id);
            }}>Delete</button>
            <button type="button" className="secondary-button small-button" onClick={onBack}>Back</button>
          </div>
        </div>

        <div className="summary-grid portfolio-grid small-grid">
          <div className="metric-card">
            <span>Cards</span>
            <strong>{selectedCards.length}</strong>
          </div>
          <div className="metric-card">
            <span>Description</span>
            <strong>{selectedList.description || 'No description'}</strong>
          </div>
        </div>

        {selectedCards.length === 0 ? (
          <div className="empty-state"><h3>No cards saved in this list yet.</h3><p>Add cards from Explore or Market to build it.</p></div>
        ) : (
          <div className="catalogue-grid collection-detail-grid">
            {selectedCards.map((card) => (
              <article className="catalogue-card card-browse" key={card.code}>
                <div className="catalogue-card__top">
                  <span className="chip neutral">#{card.cardNumber || 'N/A'}</span>
                  <span className="chip success">{card.owned ? 'Owned' : 'Missing'}</span>
                </div>
                <h3>{card.name}</h3>
                <p>{card.team}</p>
                <div className="card-footer browse-footer">
                  <span className="muted">{card.setName || card.collectionTitle || 'Collection card'}</span>
                  <button type="button" className="secondary-button small-button" onClick={() => onRemoveCardFromList?.(selectedList.id, card.code)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header row-between">
        <div>
          <p className="eyebrow">My Lists</p>
          <h1>Custom lists</h1>
        </div>
        <div className="page-chip">{lists.length} lists</div>
      </div>

      <div className="toolbar-card detail-toolbar">
        <input
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          placeholder="Create a new list"
          aria-label="Create a list"
        />
        <button type="button" className="primary-button small-button" onClick={handleCreate}>Create list</button>
      </div>

      {lists.length === 0 ? (
        <div className="empty-state"><h3>No custom lists yet.</h3><p>Create a list to organise cards by player, team or collection.</p></div>
      ) : (
        <div className="stacked-list">
          {lists.map((list) => (
            <div className="list-row" key={list.id}>
              <div>
                <strong>{list.name}</strong>
                <p>{list.description || 'No description'}</p>
              </div>
              <div className="list-detail">
                <span className="muted">{(list.cardCodes || []).length} cards</span>
                <div className="inline-actions">
                  <button type="button" className="secondary-button small-button" onClick={() => onSelectList?.(list.id)}>Open</button>
                  <button type="button" className="secondary-button small-button" onClick={() => {
                    const nextName = window.prompt('Rename this list', list.name);
                    if (nextName && typeof onRenameList === 'function') onRenameList(list.id, nextName);
                  }}>Rename</button>
                  <button type="button" className="secondary-button small-button" onClick={() => {
                    if (window.confirm('Delete this list?')) onDeleteList?.(list.id);
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
