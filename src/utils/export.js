export function exportDuplicates(stickers) {
  const dups = stickers.filter(s => s.duplicate && s.dupCount > 0);
  if (!dups.length) { alert('No duplicates to share!'); return; }
  let text = '🔄 My Panini WC 2026 DUPLICATES\n\n';
  dups.forEach(s => {
    text += `${s.code} – ${s.name} (${s.team})${s.dupCount > 1 ? ' ×' + s.dupCount : ''}\n`;
  });
  text += '\n📬 Contact me to trade!';
  if (navigator.share) {
    navigator.share({ title: 'My Panini Duplicates', text });
  } else {
    navigator.clipboard.writeText(text);
    alert('Duplicates list copied to clipboard!');
  }
}

export function exportMissing(stickers) {
  const missing = stickers.filter(s => !s.owned);
  if (!missing.length) { alert('You own everything! 🏆'); return; }
  let text = '🔍 My Panini WC 2026 MISSING STICKERS\n\n';
  const teams = [...new Set(missing.map(s => s.team))].sort();
  teams.forEach(team => {
    const ts = missing.filter(s => s.team === team);
    text += `📌 ${team}:\n`;
    ts.forEach(s => { text += `  ${s.code} – ${s.name}\n`; });
    text += '\n';
  });
  if (navigator.share) {
    navigator.share({ title: 'My Missing Stickers', text });
  } else {
    navigator.clipboard.writeText(text);
    alert('Missing list copied to clipboard!');
  }
}
