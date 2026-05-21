/**
 * Check whether any new milestones have been reached and return their labels.
 * Mutates milestonesSeen in place (same pattern as original).
 */
export function checkMilestones(stickers, milestonesSeen) {
  const toasts = [];
  const owned  = stickers.filter(s => s.owned).length;
  const pct    = stickers.length ? Math.floor((owned / stickers.length) * 100) : 0;

  [25, 50, 75, 100].forEach(m => {
    if (pct >= m && !milestonesSeen[m]) {
      milestonesSeen[m] = true;
      toasts.push(m === 100 ? '🏆 ALBUM COMPLETE! 🏆' : `🎉 ${m}% COMPLETE!`);
    }
  });

  const teams = [...new Set(stickers.map(s => s.team))];
  teams.forEach(team => {
    const ts       = stickers.filter(s => s.team === team);
    const teamOwned = ts.filter(s => s.owned).length;
    if (teamOwned === ts.length && !milestonesSeen['team_' + team]) {
      milestonesSeen['team_' + team] = true;
      toasts.push(`🌟 ${team} COMPLETE!`);
    }
  });

  return toasts;
}

export function launchConfetti() {
  const colors = ['#f0b429', '#1de982', '#38bdf8', '#ff4757', '#ffdc6e'];
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left              = Math.random() * 100 + 'vw';
    p.style.background        = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay    = Math.random() * 1.5 + 's';
    p.style.animationDuration = 1.5 + Math.random() + 's';
    p.style.transform         = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3000);
  }
}
