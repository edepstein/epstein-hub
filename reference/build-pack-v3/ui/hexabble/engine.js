/* HEXABBLE game engine: board geometry, tiles, move validation and scoring.
   Works in the browser (window.Hexabble) and in Node (module.exports) for tests. */
(function (root) {
  'use strict';

  const RADIUS = 8; // 17-tile diameter
  // Flat-topped hexes, axial coords (q = column, r). Reading directions only:
  const DIRS = [[0, 1], [1, 0], [1, -1]];
  const DIR_NAMES = ['down', 'down-right', 'up-right'];
  const NEIGHBOURS = [[0, 1], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1]];

  const LETTERS = {
    A: [9, 1], B: [2, 3], C: [2, 3], D: [4, 2], E: [12, 1], F: [2, 4], G: [3, 2], H: [2, 4],
    I: [9, 1], J: [1, 8], K: [1, 5], L: [4, 1], M: [2, 3], N: [6, 1], O: [8, 1], P: [2, 3],
    Q: [1, 10], R: [6, 1], S: [4, 1], T: [6, 1], U: [4, 1], V: [2, 4], W: [2, 4], X: [1, 8],
    Y: [2, 4], Z: [1, 10]
  };
  const SPECIAL_COUNTS = { wild: 4, key: 2, pivot: 4 };
  const RACK_SIZE = 7;
  const BINGO_BONUS = 50;

  const key = (q, r) => q + ',' + r;
  const inBoard = (q, r) => Math.abs(q) <= RADIUS && Math.abs(r) <= RADIUS && Math.abs(q + r) <= RADIUS;

  // ---------- Premium layout (derived from the board image; 6-fold symmetric) ----------
  function cubePerms(x, y, z) {
    const out = new Map();
    const base = [[x, y, z], [-x, -y, -z]];
    for (const [a, b, c] of base) {
      for (const [p, s] of [[a, b], [a, c], [b, a], [b, c], [c, a], [c, b]]) out.set(key(p, s), [p, s]);
    }
    return [...out.values()];
  }
  const PREMIUM = {};
  const setP = (list, t) => list.forEach(([q, r]) => { PREMIUM[key(q, r)] = t; });
  setP(cubePerms(8, 0, -8), 'TW');
  setP(cubePerms(4, 4, -8), 'TL');
  setP(cubePerms(1, 6, -7), 'DW');
  setP(cubePerms(3, 3, -6), 'KEY');
  setP(cubePerms(1, 4, -5), 'DL');
  setP(cubePerms(2, 2, -4), 'DL');
  setP(cubePerms(1, 1, -2), 'DL');
  PREMIUM[key(0, 0)] = 'START';
  const KEY_LOCATIONS = cubePerms(3, 3, -6);
  const premiumAt = (q, r) => PREMIUM[key(q, r)] || null;
  const LETTER_MULT = { DL: 2, TL: 3 };
  const WORD_MULT = { DW: 2, KEY: 2, START: 2, TW: 3 };

  function allCells() {
    const cells = [];
    for (let q = -RADIUS; q <= RADIUS; q++)
      for (let r = -RADIUS; r <= RADIUS; r++) if (inBoard(q, r)) cells.push([q, r]);
    return cells;
  }

  // ---------- Tiles & randomness ----------
  function defaultRng() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const a = new Uint32Array(1);
      return () => { crypto.getRandomValues(a); return a[0] / 4294967296; };
    }
    return Math.random;
  }
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function makeTiles() {
    const tiles = [];
    let id = 0;
    for (const [ch, [n, v]] of Object.entries(LETTERS))
      for (let i = 0; i < n; i++) tiles.push({ id: 't' + (id++), kind: 'letter', letter: ch, value: v });
    for (const [kind, n] of Object.entries(SPECIAL_COUNTS))
      for (let i = 0; i < n; i++) tiles.push({ id: 't' + (id++), kind, letter: null, value: 0 });
    return tiles;
  }
  const tileValue = (t) => (t.kind === 'letter' ? t.value : 0);

  // ---------- Move analysis ----------
  // placements: [{q, r, tile, assigned}]  (assigned = chosen letter for wild/key tiles)
  // dict: Set of lowercase words, or null to skip dictionary checks (preview).
  function analyzeMove(board, placements, dict) {
    const res = { ok: false, placementError: null, wordErrors: [], words: [], score: 0, bingo: false, mainWord: null };
    if (!placements || !placements.length) { res.placementError = 'Place at least one tile on the board.'; return res; }

    const newMap = {};
    for (const p of placements) {
      if (!inBoard(p.q, p.r)) { res.placementError = 'Tiles must be placed on the board.'; return res; }
      const k = key(p.q, p.r);
      if (board[k] || newMap[k]) { res.placementError = 'That space is already taken.'; return res; }
      if ((p.tile.kind === 'wild' || p.tile.kind === 'key') && !p.assigned) {
        res.placementError = 'Choose a letter for your Wild/Key tile.'; return res;
      }
      newMap[k] = p;
    }
    const letterOf = (p) => (p.tile.kind === 'letter' ? p.tile.letter : p.assigned);
    const cellAt = (q, r) => {
      const k = key(q, r);
      if (newMap[k]) { const p = newMap[k]; return { isNew: true, pivot: p.tile.kind === 'pivot', letter: p.tile.kind === 'pivot' ? null : letterOf(p), value: tileValue(p.tile), p }; }
      if (board[k]) { const b = board[k]; return { isNew: false, pivot: b.tile.kind === 'pivot', letter: b.letter, value: b.value }; }
      return null;
    };
    const isLetter = (q, r) => { if (!inBoard(q, r)) return false; const c = cellAt(q, r); return !!c && !c.pivot; };
    const runThrough = (q, r, d) => {
      let sq = q, sr = r;
      while (isLetter(sq - d[0], sr - d[1])) { sq -= d[0]; sr -= d[1]; }
      const cells = [];
      let cq = sq, cr = sr;
      while (isLetter(cq, cr)) { cells.push([cq, cr]); cq += d[0]; cr += d[1]; }
      return cells;
    };

    const letters = placements.filter((p) => p.tile.kind !== 'pivot');
    const pivots = placements.filter((p) => p.tile.kind === 'pivot');
    const keyTiles = placements.filter((p) => p.tile.kind === 'key');

    // Key tile rule
    const freeKeys = KEY_LOCATIONS.filter(([q, r]) => !board[key(q, r)]);
    const keysOnLoc = keyTiles.filter((p) => premiumAt(p.q, p.r) === 'KEY');
    if (keyTiles.length > keysOnLoc.length && freeKeys.length > keysOnLoc.length) {
      res.placementError = 'While a Key location (🔑) is free, a Key tile must be placed on one. It only works as a normal wild once all Key locations are used.';
      return res;
    }
    if (!letters.length) { res.placementError = 'A Pivot tile must sit between letters of your word.'; return res; }

    // ----- find candidate main-word paths -----
    const candidates = [];
    if (!pivots.length) {
      if (letters.length === 1) {
        const p = letters[0];
        DIRS.forEach((d) => { const run = runThrough(p.q, p.r, d); if (run.length >= 2) candidates.push({ segs: [{ d, cells: run }], pivots: [] }); });
        if (!candidates.length) {
          res.placementError = Object.keys(board).length
            ? 'A single tile must form a word with a tile already on the board.'
            : 'The first word needs at least two letters and must cover the centre start space (⬡).';
          return res;
        }
      } else {
        const a = letters[0], b = letters[1];
        const dq = b.q - a.q, dr = b.r - a.r;
        const d = DIRS.find((D) => letters.every((p) => (p.q - a.q) * D[1] - (p.r - a.r) * D[0] === 0) && dq * D[1] - dr * D[0] === 0);
        if (!d) {
          res.placementError = 'All tiles in a turn must be in one straight line: down, down-right or up-right. (A Pivot tile lets the word change direction.)';
          return res;
        }
        const run = runThrough(a.q, a.r, d);
        const rs = new Set(run.map(([q, r]) => key(q, r)));
        if (!letters.every((p) => rs.has(key(p.q, p.r)))) {
          res.placementError = 'Your tiles must form one continuous word with no gaps.';
          return res;
        }
        candidates.push({ segs: [{ d, cells: run }], pivots: [] });
      }
    } else {
      for (const perm of permutations(pivots)) {
        for (const ds of dirSequences(perm.length + 1)) {
          const c = buildPivotPath(perm, ds);
          if (c) candidates.push(c);
        }
      }
      if (!candidates.length) {
        res.placementError = 'A Pivot tile must sit between two letters of your word, where the word turns to a different reading direction (down, down-right or up-right), and every tile must be part of that word.';
        return res;
      }
    }

    function buildPivotPath(perm, ds) {
      const segs = [];
      const d0 = DIRS[ds[0]];
      let cells = [];
      let q = perm[0].q - d0[0], r = perm[0].r - d0[1];
      while (isLetter(q, r)) { cells.unshift([q, r]); q -= d0[0]; r -= d0[1]; }
      if (!cells.length) return null;
      segs.push({ d: d0, cells });
      for (let i = 0; i < perm.length - 1; i++) {
        const d = DIRS[ds[i + 1]];
        cells = [];
        q = perm[i].q; r = perm[i].r;
        let reached = false;
        for (let s = 0; s < 2 * RADIUS + 2; s++) {
          q += d[0]; r += d[1];
          if (q === perm[i + 1].q && r === perm[i + 1].r) { reached = true; break; }
          if (!isLetter(q, r)) return null;
          cells.push([q, r]);
        }
        if (!reached || !cells.length) return null;
        segs.push({ d, cells });
      }
      const dl = DIRS[ds[ds.length - 1]];
      const last = perm[perm.length - 1];
      cells = [];
      q = last.q + dl[0]; r = last.r + dl[1];
      while (isLetter(q, r)) { cells.push([q, r]); q += dl[0]; r += dl[1]; }
      if (!cells.length) return null;
      segs.push({ d: dl, cells });
      const seen = new Set();
      for (const s of segs) for (const [cq, cr] of s.cells) { const k = key(cq, cr); if (seen.has(k)) return null; seen.add(k); }
      if (!letters.every((p) => seen.has(key(p.q, p.r)))) return null;
      return { segs, pivots: perm.map((p) => [p.q, p.r]) };
    }

    const scoreWord = (cells) => {
      let sum = 0, wm = 0;
      for (const [q, r] of cells) {
        const c = cellAt(q, r);
        let v = c.value;
        if (c.isNew) {
          const pr = premiumAt(q, r);
          if (LETTER_MULT[pr]) v *= LETTER_MULT[pr];
          if (WORD_MULT[pr]) wm += WORD_MULT[pr]; // combined additively: DW + TW = 5x
        }
        sum += v;
      }
      return { score: sum * (wm || 1), wordMult: wm || 1 };
    };
    const textOf = (cells) => cells.map(([q, r]) => cellAt(q, r).letter).join('');
    const isValid = (t) => !dict || dict.has(t.toLowerCase());

    const boardHasLetters = Object.values(board).some((b) => b.tile.kind !== 'pivot');
    const coversStart = letters.some((p) => p.q === 0 && p.r === 0);
    const keyStart = keysOnLoc.length > 0;
    const bingo = placements.length === RACK_SIZE;

    function evaluate(c) {
      const out = { placementError: null, wordErrors: [], words: [], score: 0, bingo };
      const mainCells = [].concat(...c.segs.map((s) => s.cells));
      const main = { kind: 'main', cells: mainCells, text: textOf(mainCells), pivots: c.pivots, dirs: c.segs.map((s) => DIR_NAMES[DIRS.indexOf(s.d)]) };
      Object.assign(main, scoreWord(mainCells));
      out.words.push(main);
      const seen = new Set();
      for (const s of c.segs) {
        for (const [q, r] of s.cells) {
          if (!cellAt(q, r).isNew) continue;
          for (const D of DIRS) {
            if (D === s.d) continue;
            const run = runThrough(q, r, D);
            if (run.length < 2) continue;
            const k = run.map(([a, b]) => key(a, b)).join('|');
            if (seen.has(k)) continue;
            seen.add(k);
            const w = { kind: run.length >= 3 ? 'cross' : 'touch', cells: run, text: textOf(run), dirs: [DIR_NAMES[DIRS.indexOf(D)]] };
            Object.assign(w, scoreWord(run));
            out.words.push(w);
          }
        }
      }
      // connection (geometry)
      const hasExisting = (w) => w.cells.some(([q, r]) => !cellAt(q, r).isNew);
      const mainConnects = hasExisting(main);
      const sideConnects = out.words.some((w) => w.kind !== 'main' && hasExisting(w));
      if (!mainConnects && !sideConnects && !(coversStart && !board[key(0, 0)]) && !keyStart) {
        out.placementError = !boardHasLetters
          ? 'The first word must cover the centre start space (⬡), or start on a Key location (🔑) using a Key tile.'
          : 'Your word must join onto tiles already on the board (or start on the centre / a 🔑 Key location with a Key tile).';
        return out;
      }
      // validity
      for (const w of out.words) w.valid = isValid(w.text);
      const ignoredPerTile = {};
      for (const w of out.words) {
        if (w.kind === 'main') { w.counted = true; if (!w.valid) out.wordErrors.push(`"${w.text}" is not a valid word.`); }
        else if (w.kind === 'cross') { w.counted = true; if (!w.valid) out.wordErrors.push(`"${w.text}" (formed alongside your word) is not a valid word.`); }
        else {
          w.counted = w.valid;
          if (!w.valid) {
            w.ignored = true;
            for (const [q, r] of w.cells) if (cellAt(q, r).isNew) { const k = key(q, r); (ignoredPerTile[k] = ignoredPerTile[k] || []).push(w.text); }
          }
        }
      }
      for (const [k, list] of Object.entries(ignoredPerTile)) {
        if (list.length >= 2) {
          const t = cellAt(...k.split(',').map(Number)).letter;
          out.wordErrors.push(`Your ${t} touches letters forming "${list.join('" and "')}" - at least one of these must be a valid word (Adjacent Letters Rule).`);
        }
      }
      // Three-Tile Adjacency Rule
      for (const p of letters) {
        let n = 0;
        for (const [dq, dr] of NEIGHBOURS) {
          const b = board[key(p.q + dq, p.r + dr)];
          if (b && b.tile.kind !== 'pivot') n++;
        }
        if (n >= 3) {
          const ok = out.words.some((w) => w.kind !== 'main' && w.valid && w.cells.some(([q, r]) => q === p.q && r === p.r));
          if (!ok) out.wordErrors.push(`Your ${letterOf(p)} touches three tiles, so it must also form a valid word with one of them (Three-Tile Adjacency Rule).`);
        }
      }
      if (!mainConnects && !(coversStart && !board[key(0, 0)]) && !keyStart) {
        if (!out.words.some((w) => w.kind !== 'main' && w.valid && hasExisting(w)))
          out.wordErrors.push('Your word only touches the existing tiles through invalid words, so it does not connect.');
      }
      out.score = out.words.filter((w) => w.counted).reduce((s, w) => s + w.score, 0) + (bingo ? BINGO_BONUS : 0);
      return out;
    }

    const evaluated = candidates.map(evaluate);
    const rank = (e) => (e.placementError ? 0 : e.wordErrors.length ? 1 : 2);
    evaluated.sort((x, y) => rank(y) - rank(x) || y.score - x.score);
    const best = evaluated[0];
    Object.assign(res, best);
    res.mainWord = best.words[0] || null;
    res.ok = !best.placementError && !best.wordErrors.length;
    return res;
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    const out = [];
    arr.forEach((x, i) => { permutations(arr.slice(0, i).concat(arr.slice(i + 1))).forEach((p) => out.push([x].concat(p))); });
    return out;
  }
  function dirSequences(n) {
    const out = [];
    const rec = (seq) => {
      if (seq.length === n) { out.push(seq.slice()); return; }
      for (let d = 0; d < 3; d++) if (!seq.length || seq[seq.length - 1] !== d) { seq.push(d); rec(seq); seq.pop(); }
    };
    rec([]);
    return out;
  }

  // ---------- Game state ----------
  function createGame(names, opts, rng) {
    rng = rng || defaultRng();
    const game = {
      players: names.map((n) => ({ name: n, score: 0, rack: [], endAdjust: 0 })),
      bag: shuffle(makeTiles(), rng),
      board: {},
      current: 0,
      turn: 1,
      history: [],
      scoreless: 0,
      over: false,
      lastMove: [],
      opts: Object.assign({ mode: 'official' }, opts || {}),
      rng
    };
    game.players.forEach((p) => draw(game, p));
    return game;
  }
  function draw(game, player) {
    while (player.rack.length < RACK_SIZE && game.bag.length) player.rack.push(game.bag.pop());
  }
  const rackValue = (p) => p.rack.reduce((s, t) => s + tileValue(t), 0);

  function advance(game) {
    game.current = (game.current + 1) % game.players.length;
    game.turn++;
  }
  function checkScoreless(game) {
    if (game.scoreless >= 2 * game.players.length) { endGame(game, null, 'Every player passed or failed twice in a row, so no more moves can be made.'); return true; }
    return false;
  }

  // placements: [{q, r, tileId, assigned}]
  function playMove(game, placements, dict) {
    if (game.over) return { status: 'error', message: 'The game is over.' };
    if (!Array.isArray(placements) || !placements.length) return { status: 'error', message: 'Place at least one tile.' };
    if (placements.some(p => !p || typeof p !== 'object' || Array.isArray(p) || typeof p.tileId !== 'string')) return { status: 'error', message: 'Use valid placement records with rack tile IDs.' };
    if (new Set(placements.map(p => p.tileId)).size !== placements.length) return { status: 'error', message: 'A rack tile can only be used once in a move.' };
    if (placements.some(p => !Number.isInteger(p.q) || !Number.isInteger(p.r) || (p.assigned != null && (typeof p.assigned !== 'string' || !/^[A-Za-z]$/.test(p.assigned))))) return { status: 'error', message: 'Use integer board coordinates and one A–Z letter for special tiles.' };
    const player = game.players[game.current];
    const resolved = [];
    for (const pl of placements) {
      const tile = player.rack.find((t) => t.id === pl.tileId);
      if (!tile) return { status: 'error', message: 'That tile is not in your rack.' };
      resolved.push({ q: pl.q, r: pl.r, tile, assigned: pl.assigned ? pl.assigned.toUpperCase() : null });
    }
    const a = analyzeMove(game.board, resolved, dict);
    if (a.placementError) return { status: 'error', message: a.placementError, analysis: a };
    if (a.wordErrors.length) {
      if (game.opts.mode === 'friendly') return { status: 'error', message: a.wordErrors.join(' '), analysis: a };
      const entry = { type: 'challenge', player: game.current, name: player.name, words: a.words.map((w) => w.text), invalid: a.words.filter((w) => !w.valid).map((w) => w.text), reason: a.wordErrors.join(' '), score: 0, turn: game.turn };
      game.history.push(entry);
      game.scoreless++;
      if (!checkScoreless(game)) advance(game);
      return { status: 'challenged', message: a.wordErrors.join(' '), analysis: a, entry };
    }
    for (const p of resolved) {
      game.board[key(p.q, p.r)] = {
        tile: p.tile,
        letter: p.tile.kind === 'letter' ? p.tile.letter : p.tile.kind === 'pivot' ? null : p.assigned,
        value: tileValue(p.tile),
        player: game.current,
        turn: game.turn
      };
    }
    const ids = new Set(resolved.map((p) => p.tile.id));
    player.rack = player.rack.filter((t) => !ids.has(t.id));
    player.score += a.score;
    draw(game, player);
    game.scoreless = 0;
    game.lastMove = resolved.map((p) => key(p.q, p.r));
    const entry = {
      type: 'play', player: game.current, name: player.name, turn: game.turn, score: a.score, bingo: a.bingo,
      words: a.words.map((w) => ({ text: w.text, score: w.score, kind: w.kind, counted: w.counted, wordMult: w.wordMult }))
    };
    game.history.push(entry);
    if (!player.rack.length && !game.bag.length) endGame(game, game.current, `${player.name} used their last tile and the bag is empty.`);
    else advance(game);
    return { status: 'ok', analysis: a, entry };
  }

  function pass(game) {
    if (game.over) return { status: 'error', message: 'The game is over.' };
    const player = game.players[game.current];
    game.history.push({ type: 'pass', player: game.current, name: player.name, score: 0, turn: game.turn });
    game.scoreless++;
    if (!checkScoreless(game)) advance(game);
    return { status: 'ok' };
  }

  function exchange(game, tileIds) {
    if (game.over) return { status: 'error', message: 'The game is over.' };
    const player = game.players[game.current];
    if (!tileIds.length) return { status: 'error', message: 'Select at least one tile to exchange.' };
    if (game.bag.length < RACK_SIZE) return { status: 'error', message: `You can only exchange while the bag holds at least ${RACK_SIZE} tiles.` };
    const ids = new Set(tileIds);
    const out = player.rack.filter((t) => ids.has(t.id));
    if (out.length !== tileIds.length) return { status: 'error', message: 'Those tiles are not in your rack.' };
    player.rack = player.rack.filter((t) => !ids.has(t.id));
    draw(game, player);
    game.bag.push(...out);
    shuffle(game.bag, game.rng);
    game.history.push({ type: 'exchange', player: game.current, name: player.name, count: out.length, score: 0, turn: game.turn });
    game.scoreless++;
    if (!checkScoreless(game)) advance(game);
    return { status: 'ok' };
  }

  // Standard Scrabble finish: everyone loses their unplayed tile values;
  // a player who went out gains the total of everyone else's unplayed tiles.
  function endGame(game, outIdx, reason) {
    if (game.over) return;
    let others = 0;
    game.players.forEach((p, i) => {
      const v = rackValue(p);
      p.endAdjust = -v;
      p.score -= v;
      if (i !== outIdx) others += v;
    });
    if (outIdx !== null && outIdx !== undefined) {
      game.players[outIdx].score += others;
      game.players[outIdx].endAdjust += others;
    }
    game.over = true;
    game.endReason = reason || 'The game was ended.';
    const top = Math.max(...game.players.map((p) => p.score));
    game.winners = game.players.map((p, i) => (p.score === top ? i : -1)).filter((i) => i >= 0);
    game.history.push({ type: 'end', reason: game.endReason, score: 0 });
  }

  const api = {
    RADIUS, DIRS, DIR_NAMES, NEIGHBOURS, LETTERS, SPECIAL_COUNTS, RACK_SIZE, BINGO_BONUS, KEY_LOCATIONS,
    key, inBoard, premiumAt, allCells, makeTiles, shuffle, tileValue, analyzeMove, createGame, playMove,
    pass, exchange, endGame, rackValue, draw
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Hexabble = api;
})(typeof window !== 'undefined' ? window : globalThis);
