/* HEXABBLE user interface: setup, board rendering, drag & drop, turns, scoreboard. */
(function () {
  'use strict';
  const H = window.Hexabble;
  const DICT = new Set(window.HEXABBLE_WORDS.split(' '));
  window.HEXABBLE_WORDS = null;

  const COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419'];
  const COL_W = 45, ROW_H = 51.96, CELL_R = 29, TILE_R = 27.5;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const setup = { n: 2, names: ['', '', '', ''], mode: 'friendly', privacy: true };
  let game = null;
  const ui = { pending: new Map(), selected: null, prevScores: [], flash: new Set(), analysis: null };

  // ================= SETUP =================
  function renderNameInputs() {
    const box = $('nameInputs');
    box.innerHTML = '';
    for (let i = 0; i < setup.n; i++) {
      const row = document.createElement('div');
      row.className = 'name-row';
      row.innerHTML = `<span class="dot" style="background:${COLORS[i]}"></span><input aria-label="Player ${i + 1} name" maxlength="16" placeholder="Player ${i + 1}" value="${esc(setup.names[i])}" data-i="${i}">`;
      box.appendChild(row);
    }
    box.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', () => { setup.names[+inp.dataset.i] = inp.value; });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') startGame(); });
    });
  }
  $('playerCount').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    setup.n = +b.dataset.n;
    $('playerCount').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    renderNameInputs();
  });
  $('modeSel').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    setup.mode = b.dataset.mode;
    $('modeSel').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    $('modeHint').textContent = setup.mode === 'official'
      ? 'Words are checked against the supplied reference lexicon when you submit. An invalid word means you lose your turn.'
      : 'Words are checked live as you place tiles, with ✓/✗ shown. Invalid words simply cannot be placed, so nobody loses a turn.';
  });
  $('privacy').addEventListener('change', (e) => { setup.privacy = e.target.checked; });
  $('startBtn').addEventListener('click', startGame);
  $('rulesBtnSetup').addEventListener('click', showRules);

  function startGame() {
    const names = [];
    for (let i = 0; i < setup.n; i++) names.push((setup.names[i] || '').trim() || `Player ${i + 1}`);
    game = H.createGame(names, { mode: setup.mode });
    ui.pending.clear(); ui.selected = null; ui.flash.clear();
    ui.prevScores = game.players.map(() => 0);
    $('setup').classList.remove('active');
    $('game').classList.add('active');
    buildBoard();
    render();
    if (setup.privacy) showHandover();
    else toast(`${names[0]} goes first. Drag tiles onto the board, covering the centre ⬡.`, '');
  }

  function toSetup() {
    game = null;
    window.WordClubHexabble?.clear();
    closeModal(); $('handover').classList.remove('show');
    $('game').classList.remove('active');
    $('setup').classList.add('active');
    renderNameInputs();
  }

  // ================= BOARD =================
  const pos = (q, r) => [q * COL_W, (r + q / 2) * ROW_H];
  function hexPoints(s) {
    const h = (s * Math.sqrt(3)) / 2;
    return [[s, 0], [s / 2, h], [-s / 2, h], [-s, 0], [-s / 2, -h], [s / 2, -h]].map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' ');
  }
  const CELL_PTS = hexPoints(CELL_R);
  const TILE_PTS = hexPoints(TILE_R);
  const KEY_ICON = '<g class="keyi" transform="translate(0,11)"><circle cx="-8" cy="0" r="5"/><rect x="-4" y="-1.7" width="15" height="3.4"/><rect x="8" y="0" width="2.6" height="5.5"/><rect x="3.5" y="0" width="2.6" height="4"/></g>';

  function buildBoard() {
    let html = '';
    for (const [q, r] of H.allCells()) {
      const [x, y] = pos(q, r);
      const p = H.premiumAt(q, r);
      let deco = '';
      if (p === 'KEY') deco = `<text class="lbl" y="-6">DW</text>${KEY_ICON}`;
      else if (p === 'START') deco = `<polygon class="starti" points="${hexPoints(12)}"/>`;
      else if (p) deco = `<text class="lbl">${p}</text>`;
      html += `<g class="cell" data-cell="${q},${r}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})"><polygon class="bg ${p || ''}" points="${CELL_PTS}"/>${deco}<g class="tl"></g></g>`;
    }
    $('board').innerHTML = html;
  }

  function tileSVG(t, cls) {
    // t: {kind, letter, value}
    if (t.kind === 'pivot') return `<g class="tile pivott ${cls}"><polygon class="tile-bg" points="${TILE_PTS}"/><text class="tile-l" y="1">⇄</text></g>`;
    const wild = t.kind === 'wild' || t.kind === 'key';
    let s = `<g class="tile ${wild ? 'wildt' : ''} ${cls}"><polygon class="tile-bg" points="${TILE_PTS}"/><text class="tile-l" y="${wild ? -4 : -1}">${esc(t.letter || '?')}</text>`;
    if (!wild) s += `<text class="tile-v" x="17" y="17">${t.value}</text>`;
    else s += `<text class="tile-w" y="16">${t.kind === 'key' ? '🔑 KEY' : 'WILD'}</text>`;
    return s + '</g>';
  }

  function renderBoard() {
    const player = game.players[game.current];
    const last = new Set(game.lastMove);
    document.querySelectorAll('#board .cell').forEach((c) => {
      const k = c.dataset.cell;
      const slot = c.querySelector('.tl');
      const b = game.board[k];
      const pend = ui.pending.get(k);
      let html = '';
      if (b) {
        html = tileSVG({ kind: b.tile.kind, letter: b.letter, value: b.value }, (last.has(k) ? 'last ' : '') + (ui.flash.has(k) ? 'flash' : ''));
      } else if (pend) {
        const t = player.rack.find((x) => x.id === pend.tileId);
        if (t) html = tileSVG({ kind: t.kind, letter: t.kind === 'letter' ? t.letter : pend.assigned, value: t.value }, 'pending');
      }
      if (slot.innerHTML !== html) slot.innerHTML = html;
      c.classList.toggle('empty', !b && !pend);
    });
  }

  // ================= RENDER =================
  function render() {
    if (!game) return;
    const player = game.players[game.current];
    $('turnBanner').innerHTML = game.over
      ? '<b>Game over</b>'
      : `<span style="color:${COLORS[game.current]}">⬢</span> <b>${esc(player.name)}</b>'s turn <span style="color:var(--muted)">· move ${game.turn}</span>`;
    renderScoreboard();
    $('bagCount').textContent = game.bag.length;
    renderHistory();
    renderRack();
    renderBoard();
    renderPreview();
    $('exchangeBtn').disabled = game.over || game.bag.length < H.RACK_SIZE;
    $('exchangeBtn').title = game.bag.length < H.RACK_SIZE ? `Exchanges need at least ${H.RACK_SIZE} tiles in the bag` : 'Swap tiles with the bag (uses your turn)';
    $('passBtn').disabled = game.over;
    $('recallBtn').disabled = !ui.pending.size;
    window.WordClubHexabble?.sync();
    window.WordClubHexabble?.save();
  }

  function renderScoreboard() {
    const box = $('scoreboard');
    box.innerHTML = game.players.map((p, i) => `
      <div class="pcard ${i === game.current && !game.over ? 'current' : ''}">
        <span class="dot" style="background:${COLORS[i]}"></span>
        <div><div class="nm">${esc(p.name)}</div><div class="sub">${i === game.current && !game.over ? '▶ playing now · ' : ''}${p.rack.length} tile${p.rack.length === 1 ? '' : 's'}</div></div>
        <div class="sc" data-i="${i}">${p.score}</div>
      </div>`).join('');
    game.players.forEach((p, i) => {
      if (ui.prevScores[i] !== undefined && p.score > ui.prevScores[i]) box.querySelector(`.sc[data-i="${i}"]`).classList.add('bump');
      ui.prevScores[i] = p.score;
    });
  }

  function wordsHTML(e) {
    return e.words.map((w) => `<span class="${w.counted ? '' : 'ign'}" title="${w.counted ? '' : 'Invalid touch word - ignored'}"><b>${esc(w.text)}</b>&nbsp;${w.counted ? w.score : '✗'}</span>`).join(', ');
  }
  function renderHistory() {
    const items = game.history.slice().reverse().map((e) => {
      const col = e.player !== undefined ? COLORS[e.player] : 'var(--accent)';
      if (e.type === 'play')
        return `<li style="border-color:${col}"><span class="pts">+${e.score}</span><b>${esc(e.name)}</b><div class="w">${wordsHTML(e)}${e.bingo ? ` · <b>+${H.BINGO_BONUS} all 7 tiles!</b>` : ''}</div></li>`;
      if (e.type === 'challenge')
        return `<li class="bad" style="border-color:${col}"><span class="pts">0</span><b>${esc(e.name)}</b> lost the turn<div class="w" title="${esc(e.reason)}">Not allowed: <b>${esc((e.invalid || e.words).join(', '))}</b></div></li>`;
      if (e.type === 'pass') return `<li style="border-color:${col}"><span class="pts">0</span><b>${esc(e.name)}</b> passed</li>`;
      if (e.type === 'exchange') return `<li style="border-color:${col}"><span class="pts">0</span><b>${esc(e.name)}</b> exchanged ${e.count} tile${e.count === 1 ? '' : 's'}</li>`;
      if (e.type === 'end') return `<li style="border-color:var(--accent)"><b>Game over.</b> <span class="w">${esc(e.reason)}</span></li>`;
      return '';
    });
    $('history').innerHTML = items.join('') || '<li class="w" style="border-color:transparent">No moves yet. The first word must cover the centre ⬡.</li>';
  }

  function rackTileHTML(t) {
    if (t.kind === 'letter') return `${t.letter}<span class="v">${t.value}</span>`;
    if (t.kind === 'wild') return 'WILD';
    if (t.kind === 'key') return '<span class="ki">🔑</span>WILD';
    return '⇄';
  }
  function rackTileTitle(t) {
    if (t.kind === 'wild') return 'Wild: can be any letter (0 points)';
    if (t.kind === 'key') return 'Key: place on a free 🔑 Key location to start a new word anywhere; any letter, 0 points. Works as a plain wild once no Key locations are free.';
    if (t.kind === 'pivot') return 'Pivot: put it between letters to turn your word into another direction. 0 points; leaves a void space.';
    return `${t.letter}: ${t.value} point${t.value === 1 ? '' : 's'}`;
  }
  function visibleRack() {
    const used = new Set([...ui.pending.values()].map((p) => p.tileId));
    return game.players[game.current].rack.filter((t) => !used.has(t.id));
  }
  function renderRack() {
    const p = game.players[game.current];
    $('rackTitle').innerHTML = `<span style="color:${COLORS[game.current]}">⬢</span> ${esc(p.name)}'s tiles`;
    $('rackScore').textContent = game.over ? '' : `Rack value ${visibleRack().reduce((s, t) => s + H.tileValue(t), 0)}`;
    const vis = game.over ? [] : visibleRack();
    let html = '';
    for (let i = 0; i < H.RACK_SIZE; i++) {
      const t = vis[i];
      html += `<div class="slot" data-slot="${i}">${t ? `<div class="rtile ${t.kind} ${ui.selected === t.id ? 'sel' : ''}" data-tile="${t.id}" title="${esc(rackTileTitle(t))}">${rackTileHTML(t)}</div>` : ''}</div>`;
    }
    $('rack').innerHTML = html;
  }

  function currentPlacements() {
    return [...ui.pending.entries()].map(([k, v]) => {
      const [q, r] = k.split(',').map(Number);
      return { q, r, tileId: v.tileId, assigned: v.assigned || null };
    });
  }
  function resolvedPlacements() {
    const rack = game.players[game.current].rack;
    return currentPlacements().map((p) => ({ q: p.q, r: p.r, tile: rack.find((t) => t.id === p.tileId), assigned: p.assigned }));
  }

  function renderPreview() {
    const box = $('preview');
    const btn = $('placeBtn');
    ui.analysis = null;
    if (game.over) { box.innerHTML = '<span class="muted">The game has finished.</span>'; btn.disabled = true; return; }
    if (!ui.pending.size) {
      btn.disabled = true;
      box.innerHTML = `<span class="muted">Drag tiles from your rack onto the board (or click a tile, then a space). Words read <b>down ↓</b>, <b>down-right ↘</b> or <b>up-right ↗</b>.${Object.keys(game.board).length ? '' : '<br>The first word must cover the centre ⬡.'}</span>`;
      return;
    }
    const friendly = game.opts.mode === 'friendly';
    const a = H.analyzeMove(game.board, resolvedPlacements(), friendly ? DICT : null);
    ui.analysis = a;
    if (a.placementError) {
      btn.disabled = true;
      box.innerHTML = `<div class="err">⚠ ${esc(a.placementError)}</div>`;
      return;
    }
    const kindLbl = { main: '', cross: 'cross word', touch: 'touch' };
    let html = '';
    for (const w of a.words) {
      const mark = friendly ? (w.valid ? '<span class="ok">✓</span>' : w.ignored ? '<span class="muted">ignored</span>' : '<span class="no">✗</span>') : '';
      const note = w.kind === 'touch' && !friendly ? 'touch · scores if valid' : kindLbl[w.kind];
      const dir = w.kind === 'main' ? (w.dirs || []).map((d) => ({ down: '↓', 'down-right': '↘', 'up-right': '↗' }[d])).join('') : '';
      html += `<div class="wl ${w.ignored ? 'ign' : ''}"><span><span class="t">${esc(w.text)}</span> <span class="k">${dir} ${note}${w.wordMult > 1 ? ` · ${w.wordMult}× word` : ''}</span></span><span>${mark} ${w.ignored ? '' : w.score}</span></div>`;
    }
    if (a.bingo) html += `<div class="wl"><span class="t">All 7 tiles!</span><span>+${H.BINGO_BONUS}</span></div>`;
    if (friendly && a.wordErrors.length) html += a.wordErrors.map((e) => `<div class="err">✗ ${esc(e)}</div>`).join('');
    html += `<div class="total"><span>${friendly ? 'Score' : 'Projected score'}</span><span>${a.score}</span></div>`;
    if (!friendly) html += '<div class="muted" style="font-size:12px">Words are checked when you place them. An invalid word loses the turn.</div>';
    box.innerHTML = html;
    btn.disabled = friendly && !a.ok;
  }

  // ================= TILE PLACEMENT =================
  function placeTile(tileId, k) {
    const t = game.players[game.current].rack.find((x) => x.id === tileId);
    if (!t || game.board[k] || ui.pending.has(k)) return;
    ui.selected = null;
    if (t.kind === 'wild' || t.kind === 'key') {
      chooseLetter(t, null, (letter) => { ui.pending.set(k, { tileId, assigned: letter }); render(); });
      return;
    }
    ui.pending.set(k, { tileId });
    render();
  }

  function chooseLetter(t, currentKey, onPick) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const body = `<p class="hint" style="margin-bottom:12px">${t.kind === 'key' ? 'Key tile: acts as any letter and scores 0.' : 'Wild tile: acts as any letter and scores 0.'}</p><div class="letters">${letters.map((l) => `<button data-l="${l}">${l}</button>`).join('')}</div>`;
    const actions = [{ label: 'Cancel', action: closeModal }];
    if (currentKey) actions.unshift({ label: 'Return tile to rack', action: () => { ui.pending.delete(currentKey); closeModal(); render(); } });
    showModal(`Choose a letter for your ${t.kind === 'key' ? 'Key' : 'Wild'} tile`, body, actions);
    $('modalBody').querySelectorAll('.letters button').forEach((b) => b.addEventListener('click', () => { closeModal(); onPick(b.dataset.l); }));
  }

  function moveInRack(tileId, slotIdx) {
    const rack = game.players[game.current].rack;
    const tile = rack.find((t) => t.id === tileId);
    if (!tile) return;
    const vis = visibleRack().filter((t) => t.id !== tileId);
    const target = vis[slotIdx];
    rack.splice(rack.indexOf(tile), 1);
    if (target) rack.splice(rack.indexOf(target), 0, tile);
    else rack.push(tile);
  }

  // ---- pointer-based drag & drop (mouse, pen and touch) ----
  let drag = null;
  let suppressClick = false;
  document.addEventListener('pointerdown', (e) => {
    if (!game || game.over || e.button > 0) return;
    const rt = e.target.closest('#rack .rtile[data-tile]');
    const bt = e.target.closest('#board .tile.pending');
    if (rt) drag = { tileId: rt.dataset.tile, from: 'rack', el: rt };
    else if (bt) {
      const k = bt.closest('.cell').dataset.cell;
      drag = { tileId: ui.pending.get(k).tileId, from: 'board', fromKey: k, el: bt };
    } else return;
    Object.assign(drag, { x0: e.clientX, y0: e.clientY, moved: false });
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.moved = true;
      const t = game.players[game.current].rack.find((x) => x.id === drag.tileId);
      const g = document.createElement('div');
      g.className = `rtile ${t.kind} dragghost`;
      const pend = drag.from === 'board' ? ui.pending.get(drag.fromKey) : null;
      g.innerHTML = pend && pend.assigned ? pend.assigned : rackTileHTML(t);
      document.body.appendChild(g);
      drag.ghost = g;
      drag.el.style.opacity = '0.25';
    }
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
    highlightTarget(e.clientX, e.clientY);
  });
  document.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    clearHighlights();
    if (d.ghost) d.ghost.remove();
    if (d.el) d.el.style.opacity = '';
    if (!d.moved) { clickTile(d); return; }
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    dropAt(d, e.clientX, e.clientY);
  });
  document.addEventListener('pointercancel', () => {
    if (!drag) return;
    if (drag.ghost) drag.ghost.remove();
    if (drag.el) drag.el.style.opacity = '';
    drag = null; clearHighlights();
  });

  function targetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return {};
    return { cell: el.closest('#board .cell'), slot: el.closest('#rack .slot'), rack: el.closest('#rack') };
  }
  function clearHighlights() {
    document.querySelectorAll('.cell.target').forEach((c) => c.classList.remove('target'));
    document.querySelectorAll('.slot.drop').forEach((c) => c.classList.remove('drop'));
  }
  function highlightTarget(x, y) {
    clearHighlights();
    const t = targetAt(x, y);
    if (t.cell && !game.board[t.cell.dataset.cell]) t.cell.classList.add('target');
    else if (t.slot) t.slot.classList.add('drop');
  }
  function clickTile(d) {
    if (d.from === 'rack') {
      ui.selected = ui.selected === d.tileId ? null : d.tileId;
      render();
      if (ui.selected) toast('Now click an empty space on the board to place it.', '', 1800);
      return;
    }
    const pend = ui.pending.get(d.fromKey);
    const t = game.players[game.current].rack.find((x) => x.id === pend.tileId);
    if (t.kind === 'wild' || t.kind === 'key') {
      chooseLetter(t, d.fromKey, (letter) => { pend.assigned = letter; render(); });
    } else {
      ui.pending.delete(d.fromKey);
      render();
    }
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
  }
  function dropAt(d, x, y) {
    const t = targetAt(x, y);
    if (t.cell) {
      const k = t.cell.dataset.cell;
      if (game.board[k]) { if (d.from === 'board') render(); return; }
      if (d.from === 'board') {
        if (k === d.fromKey) return;
        const mine = ui.pending.get(d.fromKey);
        const other = ui.pending.get(k);
        ui.pending.delete(d.fromKey);
        if (other) ui.pending.set(d.fromKey, other);
        ui.pending.set(k, mine);
        render();
      } else {
        if (ui.pending.has(k)) ui.pending.delete(k);
        placeTile(d.tileId, k);
      }
      return;
    }
    if (t.slot || t.rack) {
      if (d.from === 'board') ui.pending.delete(d.fromKey);
      const idx = t.slot ? +t.slot.dataset.slot : H.RACK_SIZE;
      moveInRack(d.tileId, idx);
      render();
      return;
    }
    if (d.from === 'board') { ui.pending.delete(d.fromKey); render(); }
  }
  $('board').addEventListener('click', (e) => {
    if (suppressClick || !game || game.over) return;
    const c = e.target.closest('.cell');
    if (!c) return;
    const k = c.dataset.cell;
    if (ui.selected && !game.board[k] && !ui.pending.has(k)) placeTile(ui.selected, k);
  });

  // ================= TURN ACTIONS =================
  function submit() {
    if (!game || game.over || !ui.pending.size || $('placeBtn').disabled) return;
    const res = H.playMove(game, currentPlacements(), DICT);
    if (res.status === 'error') { toast(res.message, 'bad', 4500); return; }
    ui.pending.clear(); ui.selected = null;
    if (res.status === 'challenged') {
      render();
      const e = res.entry;
      showModal('Challenge! Word not allowed', `<p>${esc(res.message)}</p><p><b>${esc(e.name)}</b> loses this turn and keeps their tiles.</p>`, [{ label: 'OK', primary: true, action: () => { closeModal(); afterTurn(); } }]);
      return;
    }
    ui.flash = new Set(game.lastMove);
    render();
    setTimeout(() => { ui.flash.clear(); }, 1300);
    const e = res.entry;
    const words = e.words.filter((w) => w.counted).map((w) => `${w.text} (${w.score})`).join(', ');
    if (!setup.privacy || game.over) toast(`${e.name} scored ${e.score}: ${words}${e.bingo ? ` + ${H.BINGO_BONUS} bonus for all 7 tiles!` : ''}`, 'good', 4000);
    afterTurn();
  }
  function afterTurn() {
    if (!game) return;
    if (game.over) { render(); setTimeout(showGameOver, 600); return; }
    if (setup.privacy) showHandover();
  }
  function recall() { ui.pending.clear(); ui.selected = null; render(); }

  $('placeBtn').addEventListener('click', submit);
  $('recallBtn').addEventListener('click', recall);
  $('shuffleBtn').addEventListener('click', () => {
    if (!game || game.over) return;
    H.shuffle(game.players[game.current].rack, Math.random);
    render();
  });
  $('passBtn').addEventListener('click', () => {
    showModal('Pass your turn?', '<p>You will score nothing this turn. After twice the player count in consecutive scoreless turns (passes, exchanges or failed challenges), the game ends.</p>', [
      { label: 'Cancel', action: closeModal },
      { label: 'Pass', primary: true, action: () => { closeModal(); recall(); H.pass(game); render(); afterTurn(); } }
    ]);
  });
  $('exchangeBtn').addEventListener('click', () => {
    recall();
    const rack = game.players[game.current].rack;
    const sel = new Set();
    showModal('Exchange tiles', `<p class="hint">Click the tiles you want to swap. New tiles are drawn at random and your old ones go back in the bag. This uses your turn.</p><div class="exrack">${rack.map((t) => `<div class="rtile ${t.kind}" data-ex="${t.id}">${rackTileHTML(t)}</div>`).join('')}</div>`, [
      { label: 'Cancel', action: closeModal },
      { label: 'Exchange selected', primary: true, action: () => {
        if (!sel.size) { toast('Select at least one tile.', 'bad'); return; }
        const res = H.exchange(game, [...sel]);
        closeModal();
        if (res.status !== 'ok') { toast(res.message, 'bad'); return; }
        render(); afterTurn();
      } }
    ]);
    $('modalBody').querySelectorAll('[data-ex]').forEach((el) => el.addEventListener('click', () => {
      const id = el.dataset.ex;
      if (sel.has(id)) sel.delete(id); else sel.add(id);
      el.classList.toggle('exsel', sel.has(id));
    }));
  });
  $('endBtn').addEventListener('click', () => {
    if (!game || game.over) { if (game) showGameOver(); return; }
    showModal('End the game now?', '<p>Use this when no more valid moves can be made. Everyone loses the value of the tiles left on their rack and the highest score wins.</p>', [
      { label: 'Cancel', action: closeModal },
      { label: 'End game', primary: true, action: () => { closeModal(); recall(); H.endGame(game, null, 'The players agreed no more valid moves could be made.'); render(); showGameOver(); } }
    ]);
  });
  $('restartBtn').addEventListener('click', () => {
    showModal('Restart?', '<p>This clears the board and scores and goes back to player setup.</p>', [
      { label: 'Cancel', action: closeModal },
      { label: 'Restart', primary: true, action: toSetup }
    ]);
  });
  $('rulesBtn').addEventListener('click', showRules);

  document.addEventListener('keydown', (e) => {
    if (!game || !$('game').classList.contains('active')) return;
    if ($('modal').classList.contains('show')) { if (e.key === 'Escape') closeModal(); return; }
    if ($('handover').classList.contains('show')) { if (e.key === 'Enter') reveal(); return; }
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Enter') submit();
    else if (e.key === 'Escape') recall();
  });

  // ================= OVERLAYS =================
  function showHandover() {
    const p = game.players[game.current];
    $('handDot').style.background = COLORS[game.current];
    $('handTitle').textContent = `${p.name}'s turn`;
    const last = [...game.history].reverse().find((e) => e.type !== 'end');
    let sub = `Score: ${p.score}. Make sure only ${p.name} is looking, then show the tiles.`;
    if (last) {
      if (last.type === 'play') sub = `Last move: ${last.name} scored ${last.score} (${last.words.filter((w) => w.counted).map((w) => w.text).join(', ')}). ` + sub;
      else if (last.type === 'challenge') sub = `Last move: ${last.name}'s word was not allowed, so they lost the turn. ` + sub;
      else if (last.type === 'pass') sub = `Last move: ${last.name} passed. ` + sub;
      else if (last.type === 'exchange') sub = `Last move: ${last.name} exchanged ${last.count} tile(s). ` + sub;
    }
    $('handSub').textContent = sub;
    $('handover').classList.add('show');
  }
  function reveal() { $('handover').classList.remove('show'); }
  $('revealBtn').addEventListener('click', reveal);

  function showModal(title, body, actions) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = body;
    const box = $('modalActions');
    box.innerHTML = '';
    (actions || []).forEach((a) => {
      const b = document.createElement('button');
      b.className = 'btn' + (a.primary ? ' primary' : '');
      b.textContent = a.label;
      b.addEventListener('click', a.action);
      box.appendChild(b);
    });
    $('modal').classList.add('show');
    $('modalCard').scrollTop = 0;
  }
  function closeModal() { $('modal').classList.remove('show'); }

  function showGameOver() {
    $('handover').classList.remove('show');
    const order = game.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);
    const winners = game.winners.map((i) => game.players[i].name);
    const rows = order.map(({ p, i }) => `<tr class="${game.winners.includes(i) ? 'win' : ''}"><td><span style="color:${COLORS[i]}">⬢</span> ${esc(p.name)}</td><td>${p.score - p.endAdjust}</td><td>${p.endAdjust >= 0 ? '+' : ''}${p.endAdjust}</td><td>${p.score}</td></tr>`).join('');
    showModal(winners.length > 1 ? `It's a tie: ${winners.join(' & ')}!` : `🏆 ${winners[0]} wins!`,
      `<p class="hint">${esc(game.endReason)}</p><table class="final"><tr><th>Player</th><th>Play score</th><th>Unplayed tiles</th><th>Final</th></tr>${rows}</table>
       <p class="hint">Unplayed tiles are deducted; a player who used all their tiles gains everyone else's unplayed tile values.</p>`,
      [{ label: 'Change players', action: toSetup }, { label: 'Play again', primary: true, action: () => { closeModal(); startGame(); } }]);
  }

  function showRules() {
    showModal('How to play HEXABBLE', `<div class="rules">
      <h3>Aim</h3><p>Score the most points by making words on the hexagonal board. Each player holds 7 tiles.</p>
      <h3>Placing a word</h3><ul>
        <li>Words read in one of three directions: <b>down ↓</b>, <b>down-right ↘</b> or <b>up-right ↗</b>.</li>
        <li>Put all of this turn's tiles in one line with no gaps (existing tiles can fill gaps), then press <b>Place tiles</b> (or Enter).</li>
        <li>The first word must cover the centre ⬡. After that, words must join onto tiles already on the board.</li>
        <li>Every word you make in any direction counts. Longer cross words (3+ letters) must all be valid.</li>
        <li><b>Adjacent Letters Rule:</b> on a hex board a tile often touches two letters. A two-letter "touch" that is a real word scores; one that isn't is ignored. Each placed tile may have at most one ignored touch, so a tile touching two letters must make a valid word with at least one of them.</li>
        <li><b>Three-Tile Adjacency Rule:</b> a tile that touches three tiles already on the board must also make a valid word with one of them.</li>
      </ul>
      <h3>Special tiles</h3><ul>
        <li><b>WILD</b> (×4): any letter, 0 points.</li>
        <li><b>🔑 KEY</b> (×2): any letter, 0 points. Put it on a free 🔑 Key location to start a new word anywhere, without joining existing tiles. While a Key location is free, Key tiles must go on one; once they are all used, a Key is just a wild.</li>
        <li><b>⇄ PIVOT</b> (×4): place it between two letters of your word to turn the word into a different reading direction (for example CA ⇄ TS reads CATS). It scores 0, leaves a void that nobody can play on or through, and doesn't count as a neighbour.</li>
      </ul>
      <h3>Scoring</h3><ul>
        <li>Standard Scrabble letter values. DL and TL multiply a newly placed letter; DW and TW multiply the word.</li>
        <li>Word multipliers <b>add up</b>: DW + TW = 5×, DW + DW = 4×. The centre ⬡ and 🔑 Key locations are double word spaces.</li>
        <li>Premium spaces only count on the turn they are covered. Using all 7 tiles in one turn earns a <b>+50</b> bonus.</li>
      </ul>
      <h3>Other moves</h3><ul>
        <li><b>Exchange</b> tiles (only while 7+ remain in the bag) or <b>Pass</b>. Either uses your turn.</li>
        <li><b>Challenge mode:</b> an invalid word means you lose your turn (Challenge Rule). <b>Friendly mode:</b> words are checked live.</li>
      </ul>
      <h3>End of the game</h3><p>The game ends when the bag is empty and a player uses their last tile, after twice the player count in consecutive scoreless turns (passes, exchanges or failed challenges), or when you press <b>End game</b> because no more valid moves are possible. Unplayed tile values are deducted, and a player who went out gains the others' unplayed tiles.</p>
      <h3>Dictionary</h3><p>The supplied 252,209-entry merged lexicon is used for this reference. It includes some obscure terms and abbreviations, so it is not a curated common-word dictionary or an official tournament lexicon. Production must pin a reviewed dictionary and retain its source notices.</p>
    </div>`, [{ label: 'Close', primary: true, action: closeModal }]);
  }

  let toastTimer = null;
  function toast(msg, kind, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = 'toast ' + (kind || ''); }, ms || 3000);
  }

  renderNameInputs();
  // test hook
  window.__hx = { get game() { return game; }, load(g) { g.rng = Math.random; game = g; ui.pending.clear(); ui.prevScores = g.players.map((p) => p.score); $('setup').classList.remove('active'); $('game').classList.add('active'); buildBoard(); render(); }, ui, DICT, placeTile, submit, render, startGame, setup, showModal, closeModal };
})();
