/* Local V2 records. One best result per game, stored only in this browser. */
(() => {
  const STORAGE_KEY = "werksporen-game-records-v1";
  const defaults = Object.freeze({
    memory:{ score:0, secondary:0 },
    mines:{ score:0, secondary:0 },
    snake:{ score:0, secondary:0 },
    tetris:{ score:19254, secondary:49 }
  });
  let scores = structuredClone(defaults);

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    for (const game of Object.keys(defaults)) {
      const record = stored?.[game];
      if (!record) continue;
      scores[game] = {
        score:Math.max(0,Math.round(Number(record.score) || 0)),
        secondary:Math.max(0,Math.round(Number(record.secondary) || 0))
      };
    }
  } catch {}

  function save() {
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(scores)); } catch {}
    window.dispatchEvent(new CustomEvent("portfolio-scores:update", { detail:{ scores:structuredClone(scores) } }));
  }
  function submit(game, score, secondary = 0) {
    if (!defaults[game]) return { score:0, secondary:0 };
    const candidate = {
      score:Math.max(0,Math.round(Number(score) || 0)),
      secondary:Math.max(0,Math.round(Number(secondary) || 0))
    };
    const current = scores[game];
    const better = game === "memory"
      ? candidate.score > 0 && (!current.score || candidate.score < current.score || (candidate.score === current.score && candidate.secondary < current.secondary))
      : candidate.score > current.score || (candidate.score === current.score && candidate.secondary > current.secondary);
    if (better) { scores[game] = candidate; save(); }
    return { ...scores[game] };
  }
  window.portfolioScores = {
    get(game) { return { ...(scores[game] || { score:0, secondary:0 }) }; },
    submit,
    reset(game) { if (defaults[game]) { scores[game] = { ...defaults[game] }; save(); } }
  };
})();
