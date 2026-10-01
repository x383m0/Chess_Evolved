import './style.css';
import { GameSession } from './session.js';
import { PIECES } from './rules.js';
import { Multiplayer } from './network.js';

const $ = id => document.getElementById(id);
const colorName = c => c === 'w' ? 'White' : 'Black';
let session = new GameSession(), mode = 'local', color = 'w', flipped = false, selected = null, pending = false, ready = false, room = '', status = 'Local play', actionTimer;
const invite = new URLSearchParams(location.search).get('room') || '';
document.querySelector('#app').innerHTML = `
<header><a class="brand" href="./"><span class="brand-mark">♞</span><span>CHESS <b>EVOLVED</b></span></a><div class="header-right"><span class="edition">CLASSIC / 01</span><button id="help" class="icon-button" aria-label="How to play">?</button></div></header>
<main><section class="play-area"><div class="player-line"><span class="avatar">♟</span><div><strong id="top-player">Black</strong><span id="top-caption">Ready to play</span></div><span class="player-tag" id="top-tag">BLACK</span></div>
<div class="board-frame"><div id="board" class="board" role="group" aria-label="Chess board"></div></div>
<div class="player-line"><span class="avatar light">♟</span><div><strong id="bottom-player">White</strong><span id="bottom-caption">Your move</span></div><span class="player-tag" id="bottom-tag">WHITE</span></div>
<div class="board-toolbar"><span id="position-note">Select a piece to see its legal moves.</span><div><button id="flip" class="text-button">⇅ Flip board</button><button id="export" class="text-button">Export PGN</button></div></div></section>
<aside><section class="game-heading"><div class="eyebrow">THE ORIGINAL GAME</div><h1>Classic chess<span class="small-dot"></span></h1><p>No clock. Take your time.</p></section>
<section class="panel"><div class="panel-title"><h2>Play with a friend</h2><span id="connection-badge" class="badge">LOCAL</span></div>
<div class="mode-tabs"><button id="local" class="active">Same device</button><button id="online">Online</button></div>
<div id="local-controls"><p class="muted">Two players, one board. White moves first.</p><button id="new-local" class="secondary full">New local game</button></div>
<div id="online-controls" hidden><div id="room-setup"><button id="host" class="primary full">Create a room</button><div class="divider"><span>or join a friend</span></div><label for="room-input">Room code</label><div class="join-row"><input id="room-input" placeholder="e.g. K7MT4QXP" maxlength="16" autocomplete="off" spellcheck="false"><button id="join" class="secondary">Join</button></div></div>
<div id="room-active" hidden><div class="room-label">YOUR ROOM CODE</div><div class="room-code" id="room-code"></div><div class="room-buttons"><button id="copy-code" class="secondary">Copy code</button><button id="copy-link" class="secondary">Copy invite</button></div><p class="muted" id="room-hint">Keep this tab open while your friend joins.</p><div class="room-buttons"><button id="reconnect" class="text-button">Reconnect</button><button id="leave" class="text-button danger">Leave room</button></div></div><p id="network-status" class="network-status" role="status"></p></div></section>
<section class="panel state-panel"><div class="eyebrow" id="turn-label">WHITE TO MOVE</div><h2 id="game-status">The opening is yours.</h2><p id="game-detail">Select a piece on the board to begin.</p><div id="draw-response" hidden><button id="accept-draw" class="primary">Accept draw</button><button id="decline-draw" class="secondary">Decline</button></div><div class="game-actions"><button id="draw" class="text-button">Offer draw</button><button id="resign" class="text-button danger">Resign</button><button id="rematch" class="primary" hidden>Play again</button></div></section>
<section class="panel history-panel"><div class="panel-title"><h2>Move history</h2><span id="move-count" class="muted">0 moves</span></div><div class="history-columns"><span>#</span><span>White</span><span>Black</span></div><div id="history" class="history"><div class="empty-history">Every game starts with a possibility.<span>Your moves will appear here.</span></div></div></section>
<div class="footer-note"><span>STANDARD RULES</span><span>v1.0.0</span></div></aside></main>
<div id="toast" role="status" hidden></div>
<dialog id="dialog"><form method="dialog"><div id="dialog-content"></div><div id="dialog-actions"></div></form></dialog>`;

const net = new Multiplayer({
  status(text) { status = text; $('network-status').textContent = text; render(); },
  room(code) { room = code; $('room-code').textContent = room; $('room-setup').hidden = true; $('room-active').hidden = false; },
  connected() { ready = true; pending = false; clearTimeout(actionTimer); if (net.isHost) sendState(); render(); },
  disconnected() { ready = false; pending = false; clearTimeout(actionTimer); render(); },
  failure() { if (!net.connected) { ready = false; pending = false; } render(); },
  message(msg) {
    if (net.isHost) {
      if (msg.type === 'sync') { sendState(); return; }
      if (msg.type !== 'action') return;
      try { session.dispatch(msg.action, 'b', msg.gameId, msg.revision); sendState(); render(); }
      catch (e) { net.send({ type:'error', message:e.message }); sendState(); }
    } else if (msg.type === 'state') {
      try {
        if (msg.state?.gameId === session.gameId && msg.state.revision < session.revision) return;
        session.restore(msg.state); pending = false; clearTimeout(actionTimer); selected = null; render();
      } catch { ready = false; toast('Game versions do not match. Leave and update both browsers.'); render(); }
    } else if (msg.type === 'error') { pending = false; clearTimeout(actionTimer); toast(msg.message); render(); }
  }
});
function sendState() { net.send({ type:'state', state:session.snapshot() }); }
function canPlay() { return !session.result && !pending && (mode === 'local' || (ready && net.connected && session.rules.turn === color)); }
function dispatch(action) {
  const actor = mode === 'local' ? session.rules.turn : color;
  if (mode === 'online' && (!ready || !net.connected || pending)) return toast('Wait for your friend to connect.');
  try {
    if (mode === 'online' && !net.isHost) {
      pending = true;
      if (!net.send({ type:'action', action, gameId:session.gameId, revision:session.revision })) { pending = false; return toast('Connection lost. Reconnect to continue.'); }
      actionTimer = setTimeout(() => { pending = false; net.send({ type:'sync' }); toast('No response yet. Synchronizing the game…'); render(); }, 8000);
    } else {
      session.dispatch(action, actor);
      if (mode === 'online') sendState();
    }
    selected = null; render();
  } catch (e) { toast(e.message); }
}
function render() {
  const rules = session.rules, result = session.result, view = flipped ? 'b' : 'w';
  const last = rules.chess.history({ verbose:true }).at(-1);
  const moves = selected ? rules.legalMoves(selected) : [];
  const ranks = view === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const files = view === 'w' ? 'abcdefgh' : 'hgfedcba';
  const active = document.activeElement?.dataset.square;
  const fragment = document.createDocumentFragment();
  for (let ri = 0; ri < 8; ri++) for (let fi = 0; fi < 8; fi++) {
    const square = files[fi] + ranks[ri], p = rules.piece(square), legal = moves.some(m => m.to === square);
    const cell = document.createElement('button'); cell.type = 'button'; cell.dataset.square = square;
    const dark = ('abcdefgh'.indexOf(files[fi]) + ranks[ri]) % 2 === 0;
    cell.className = `square ${dark ? 'dark' : 'pale'}${selected === square ? ' selected' : ''}${last && [last.from,last.to].includes(square) ? ' last' : ''}${legal ? p ? ' capture' : ' legal' : ''}${p?.type === 'k' && p.color === rules.turn && rules.inCheck ? ' check' : ''}`;
    cell.setAttribute('aria-label', `${square}${p ? ` ${colorName(p.color)} ${PIECES[p.type].name}` : ' empty'}${legal ? ', legal destination' : ''}`);
    cell.setAttribute('aria-pressed', String(selected === square));
    if (p) { const piece = document.createElement('span'); piece.className = `piece ${p.color === 'w' ? 'white' : 'black'}`; piece.textContent = PIECES[p.type].glyph; piece.setAttribute('aria-hidden','true'); cell.append(piece); }
    if (ri === 7) { const label = document.createElement('span'); label.className = 'file-label'; label.textContent = files[fi]; cell.append(label); }
    if (fi === 0) { const label = document.createElement('span'); label.className = 'rank-label'; label.textContent = ranks[ri]; cell.append(label); }
    cell.onclick = () => selectSquare(square); cell.onkeydown = boardKey;
    fragment.append(cell);
  }
  $('board').replaceChildren(fragment);
  if (active) document.querySelector(`[data-square="${active}"]`)?.focus({preventScroll:true});
  $('local').classList.toggle('active', mode === 'local'); $('online').classList.toggle('active', mode === 'online');
  $('local-controls').hidden = mode !== 'local'; $('online-controls').hidden = mode !== 'online';
  $('connection-badge').textContent = mode === 'local' ? 'LOCAL' : ready ? 'CONNECTED' : 'ONLINE';
  $('connection-badge').classList.toggle('connected',mode === 'online' && ready);
  const top = view === 'w' ? 'b' : 'w', bottom = view;
  for (const [prefix,c] of [['top',top],['bottom',bottom]]) {
    $(prefix+'-player').textContent = mode === 'local' ? colorName(c) : c === color ? `You · ${colorName(c)}` : `Friend · ${colorName(c)}`;
    $(prefix+'-tag').textContent = colorName(c).toUpperCase();
    $(prefix+'-caption').textContent = result ? 'Game finished' : mode === 'online' && !ready ? 'Waiting for connection' : rules.turn === c ? 'To move' : 'Waiting';
  }
  $('turn-label').textContent = result ? 'GAME COMPLETE' : `${colorName(rules.turn).toUpperCase()} TO MOVE`;
  $('game-status').textContent = result ? result.winner ? `${colorName(result.winner)} wins.` : 'A shared result.' : mode === 'online' && !ready ? 'Waiting for your friend.' : rules.inCheck ? `${colorName(rules.turn)} is in check.` : rules.history.length ? mode === 'online' && rules.turn !== color ? 'Your friend’s move.' : 'Your move.' : 'The opening is yours.';
  $('game-detail').textContent = result ? result.reason : pending ? 'Confirming your action…' : mode === 'online' && !ready ? status : session.drawOffer ? `${colorName(session.drawOffer)} offered a draw.` : rules.inCheck ? 'Protect your king to continue.' : selected ? `Choose a highlighted square for your ${PIECES[rules.piece(selected).type].name.toLowerCase()}.` : 'Select a piece on the board to begin.';
  $('position-note').textContent = result ? result.reason : pending ? 'Waiting for confirmation…' : 'Select a piece to see its legal moves.';
  const hasDraw = session.drawOffer && (mode === 'local' || session.drawOffer !== color);
  $('draw-response').hidden = !hasDraw || !!result;
  $('accept-draw').disabled = $('decline-draw').disabled = pending || mode === 'online' && !ready;
  $('draw').disabled = !!result || !!session.drawOffer || pending || mode === 'online' && !ready;
  $('resign').disabled = !!result || pending || mode === 'online' && !ready;
  $('rematch').hidden = !result; $('rematch').disabled = pending || mode === 'online' && (!ready || session.rematch.includes(color));
  $('rematch').textContent = session.rematch.length ? session.rematch.includes(color) ? 'Waiting for your friend…' : 'Accept rematch' : 'Play again';
  $('draw').hidden = !!result; $('resign').hidden = !!result;
  $('reconnect').hidden = net.isHost || ready; $('host').disabled = false;
  $('room-hint').textContent = net.isHost ? 'You play White. Keep this tab open for the game.' : 'You play Black. Reconnect here if the connection drops.';
  const history = rules.history; $('move-count').textContent = `${Math.ceil(history.length/2)} moves`;
  if (history.length) {
    $('history').innerHTML = '';
    for (let i = 0; i < history.length; i += 2) { const row = document.createElement('div'); row.className = 'history-row'; for (const value of [String(i/2+1)+'.', history[i], history[i+1] || '—']) { const span = document.createElement('span'); span.textContent = value; row.append(span); } $('history').append(row); }
    $('history').scrollTop = $('history').scrollHeight;
  } else $('history').innerHTML = '<div class="empty-history">Every game starts with a possibility.<span>Your moves will appear here.</span></div>';
}
function boardKey(event) {
  const buttons = [...$('board').children], index = buttons.indexOf(event.currentTarget);
  const offsets = { ArrowRight:1, ArrowLeft:-1, ArrowUp:-8, ArrowDown:8 };
  if (event.key in offsets) { event.preventDefault(); const next = index + offsets[event.key]; if (next >= 0 && next < 64) buttons[next].focus(); }
  if (event.key === 'Escape') { selected = null; render(); }
}
function selectSquare(square) {
  if (!canPlay()) return;
  if (selected === square) { selected = null; render(); return; }
  if (selected) {
    const options = session.rules.legalMoves(selected).filter(m => m.to === square);
    if (options.length) {
      const from = selected, gameId = session.gameId, revision = session.revision;
      if (options.some(m => m.promotion)) {
        modal('Choose your promotion', 'Your pawn has reached the last rank.', ['Queen','Rook','Bishop','Knight','Cancel'], choice => { if (choice < 4 && gameId === session.gameId && revision === session.revision && canPlay()) dispatch({ type:'move', from, to:square, promotion:['q','r','b','n'][choice] }); });
      } else dispatch({ type:'move', from, to:square });
      return;
    }
  }
  const piece = session.rules.piece(square);
  selected = piece?.color === session.rules.turn ? square : null; render();
}
function modal(title, detail, labels, cb) {
  $('dialog-content').replaceChildren(); const h = document.createElement('h2'); h.textContent = title; const p = document.createElement('p'); p.textContent = detail; $('dialog-content').append(h,p);
  $('dialog-actions').replaceChildren();
  labels.forEach((label,i) => { const b = document.createElement('button'); b.type = 'button'; b.className = i === 0 ? 'primary' : 'secondary'; b.textContent = label; b.onclick = () => { $('dialog').close(); cb?.(i); }; $('dialog-actions').append(b); });
  $('dialog').showModal();
}
let toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }
function freshLocal() { net.stop(); clearTimeout(actionTimer); mode = 'local'; ready = false; pending = false; selected = null; session = new GameSession(); room = ''; status = 'Local play'; $('room-setup').hidden = false; $('room-active').hidden = true; render(); }
function confirmLeave(callback) {
  if (session.rules.history.length || mode === 'online' && room) modal('Leave this game?', 'The current game will be lost on this device.', ['Leave game','Keep playing'], i => { if (i === 0) callback(); });
  else callback();
}
$('local').onclick = () => { if (mode !== 'local') confirmLeave(freshLocal); };
$('online').onclick = () => { if (mode === 'online') return; confirmLeave(() => { freshLocal(); mode = 'online'; render(); }); };
$('new-local').onclick = () => confirmLeave(freshLocal);
$('host').onclick = () => { session = new GameSession(); mode = 'online'; color = 'w'; flipped = false; ready = false; room = net.host(); selected = null; render(); };
$('join').onclick = () => {
  try { color = 'b'; flipped = true; selected = null; ready = false; net.join($('room-input').value); room = net.code; $('room-code').textContent = room; $('room-setup').hidden = true; $('room-active').hidden = false; render(); } catch(e) { toast(e.message); }
};
$('room-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('join').click(); });
$('leave').onclick = () => confirmLeave(freshLocal);
$('reconnect').onclick = () => { ready = false; net.retry(); render(); };
async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied. Send it to your friend.'); } catch { modal('Copy your invite', text, ['Close']); } }
$('copy-code').onclick = () => copy(room);
$('copy-link').onclick = () => { const url = new URL(location.href); url.search = ''; url.searchParams.set('room', room); url.hash = ''; copy(url.toString()); };
$('flip').onclick = () => { flipped = !flipped; render(); };
$('draw').onclick = () => dispatch({type:'offer-draw'});
$('accept-draw').onclick = () => { if (mode === 'local') { session.dispatch({type:'accept-draw'}, session.drawOffer === 'w' ? 'b' : 'w'); render(); } else dispatch({type:'accept-draw'}); };
$('decline-draw').onclick = () => { if (mode === 'local') { session.dispatch({type:'decline-draw'}, session.drawOffer === 'w' ? 'b' : 'w'); render(); } else dispatch({type:'decline-draw'}); };
$('resign').onclick = () => modal('Resign this game?', `${colorName(mode === 'local' ? session.rules.turn : color)} will resign.`, ['Resign','Keep playing'], i => { if (i === 0) dispatch({type:'resign'}); });
$('rematch').onclick = () => { if (mode === 'local') freshLocal(); else dispatch({type:'rematch'}); };
$('help').onclick = () => modal('Your next move', 'Click a piece, then a highlighted square. Use arrow keys and Enter to play with a keyboard. Create an online room and send its code or invite to a friend; the host plays White. Both players must keep their tabs open. Classic rules include castling, en passant, promotion, checkmate and draws. This version has no clock or computer opponent.', ['Got it']);
$('export').onclick = () => {
  const result = session.result; const token = result ? result.winner === 'w' ? '1-0' : result.winner === 'b' ? '0-1' : '1/2-1/2' : '*';
  session.rules.chess.header('Event','Chess Evolved casual game','White','White','Black','Black','Result',token);
  const blob = new Blob([session.rules.chess.pgn()],{type:'application/x-chess-pgn'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chess-evolved.pgn'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href),1000);
};
if (invite) { mode = 'online'; $('room-input').value = invite; }
window.addEventListener('beforeunload', e => { if (mode === 'online' && room && !session.result) { e.preventDefault(); e.returnValue = ''; } });
render();
