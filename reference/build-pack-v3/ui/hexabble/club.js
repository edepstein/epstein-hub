/* Local integration: versioned session save, keyboard alternatives and dialog focus.
   This is a device-local prototype, not account sync or remote multiplayer. */
(()=>{'use strict';
const api=window.__hx,H=window.Hexabble,$=id=>document.getElementById(id);
const STORAGE='wordclub.hexabble.session.v1',SIGNATURE='hexabble-217-108-merged252209-v1';let failedSave=false,restoreFocus=null,activeOverlay=null;
function status(text){$('clubSave').textContent=text}
function snapshot(){return{schemaVersion:1,signature:SIGNATURE,savedAt:new Date().toISOString(),setup:{...api.setup},game:api.game,pending:[...api.ui.pending],selected:api.ui.selected}}
function save(){if(!api.game)return;try{localStorage.setItem(STORAGE,JSON.stringify(snapshot()));$('resumeBtn').hidden=false;status('Saved on this device')}catch(e){if(!failedSave){status('Save unavailable. Keep this tab open.');failedSave=true}}}
function clear(){try{localStorage.removeItem(STORAGE)}catch(e){}$('resumeBtn').hidden=true;status('Saves on this device')}
function valid(s){
 if(!s||s.schemaVersion!==1||s.signature!==SIGNATURE||!s.game||!s.setup)return false;const g=s.game;
 if(!Array.isArray(g.players)||g.players.length<2||g.players.length>4||!Array.isArray(g.bag)||!Array.isArray(g.history)||!Array.isArray(g.lastMove)||!g.board||Array.isArray(g.board)||!Number.isInteger(g.current)||g.current<0||g.current>=g.players.length||!Number.isInteger(g.turn)||g.turn<1||!Number.isInteger(g.scoreless)||typeof g.over!=='boolean'||!['friendly','official'].includes(g.opts?.mode)||g.opts.mode!==s.setup.mode||typeof s.setup.privacy!=='boolean')return false;
 const canonical=new Map(H.makeTiles().map(t=>[t.id,t])),seen=new Set();let count=0;
 function tile(t){const c=canonical.get(t?.id);if(!c||seen.has(t.id)||c.kind!==t.kind||c.letter!==t.letter||c.value!==t.value)return false;seen.add(t.id);count++;return true}
 for(const t of g.bag)if(!tile(t))return false;
 for(const p of g.players){if(typeof p.name!=='string'||p.name.length>100||!Number.isFinite(p.score)||!Array.isArray(p.rack)||p.rack.length>7)return false;for(const t of p.rack)if(!tile(t))return false}
 for(const [key,b] of Object.entries(g.board)){const [q,r]=key.split(',').map(Number);if(!Number.isInteger(q)||!Number.isInteger(r)||!H.inBoard(q,r)||!tile(b.tile)||b.value!==H.tileValue(b.tile))return false;if(b.tile.kind==='pivot'?b.letter!==null:!(/^[A-Z]$/.test(b.letter)))return false}
 if(count!==canonical.size)return false;
 if(g.over&&(!Array.isArray(g.winners)||g.winners.some(i=>!Number.isInteger(i)||i<0||i>=g.players.length)))return false;
 if(!Array.isArray(s.pending))return false;const ids=new Set(),cells=new Set();for(const [key,p] of s.pending){const [q,r]=key.split(',').map(Number);if(!Number.isInteger(q)||!Number.isInteger(r)||!H.inBoard(q,r)||g.board[key]||cells.has(key)||ids.has(p.tileId)||!g.players[g.current].rack.some(t=>t.id===p.tileId))return false;if(p.assigned!=null&&!/^[A-Z]$/.test(p.assigned))return false;ids.add(p.tileId);cells.add(key)}return true;
}
function read(){try{const raw=localStorage.getItem(STORAGE);if(!raw)return null;const s=JSON.parse(raw);if(valid(s))return s;status('Saved game could not be restored. Start a new game.');return null}catch(e){status('Saved game could not be read. Start a new game.');return null}}
function sync(){
 document.querySelectorAll('#rack .rtile').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label',el.title||el.textContent);el.setAttribute('aria-pressed',String(api.ui.selected===el.dataset.tile))});
 let focusCell=document.querySelector('#board .cell[tabindex="0"]');if(!focusCell)focusCell=document.querySelector('#board .cell[data-cell="0,0"]');
 document.querySelectorAll('#board .cell').forEach(el=>{const k=el.dataset.cell,b=api.game?.board[k],p=api.ui.pending.get(k),coords=k.split(',');el.tabIndex=el===focusCell?0:-1;el.setAttribute('role','button');el.setAttribute('aria-label',`Column ${coords[0]}, row ${coords[1]}, ${b?b.letter||'pivot':p?'draft tile':'empty'}, ${H.premiumAt(...coords.map(Number))||'normal space'}`)});
}
function focusOverlays(){const overlay=$('modal').classList.contains('show')?$('modal'):$('handover').classList.contains('show')?$('handover'):null;if(overlay===activeOverlay)return;const old=activeOverlay;activeOverlay=overlay;if(overlay){if(!old)restoreFocus=document.activeElement;$('game').inert=true;$('setup').inert=true;document.querySelector('.clubbar').inert=true;overlay.querySelector('button')?.focus()}else{$('game').inert=false;$('setup').inert=false;document.querySelector('.clubbar').inert=false;if(restoreFocus?.isConnected)restoreFocus.focus();else $('placeBtn').focus();restoreFocus=null}}
window.WordClubHexabble={save,clear,sync};
$('toast').setAttribute('role','status');$('toast').setAttribute('aria-live','polite');
for(const [id,title] of [['modal','modalTitle'],['handover','handTitle']]){const card=$(id).querySelector('.card');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-labelledby',title);new MutationObserver(focusOverlays).observe($(id),{attributes:true,attributeFilter:['class']})}
$('resumeBtn').hidden=!read();$('resumeBtn').onclick=()=>{const s=read();if(!s)return;Object.assign(api.setup,s.setup);api.load(s.game);api.ui.pending=new Map(s.pending);api.ui.selected=s.selected;api.render();if(api.setup.privacy&&!api.game.over){$('handTitle').textContent=api.game.players[api.game.current].name+"'s turn";$('handSub').textContent='Saved game restored. Show tiles when only this player is looking.';$('handover').classList.add('show')}if(api.game.over)$('endBtn').click();centreBoard()};
function centreBoard(){const box=document.querySelector('.boardwrap');box.scrollLeft=Math.max(0,(box.scrollWidth-box.clientWidth)/2);box.scrollTop=Math.max(0,(box.scrollHeight-box.clientHeight)/2)}
$('boardScale').value=innerWidth<=700?'readable':'fit';document.body.classList.toggle('readable-board',$('boardScale').value==='readable');$('boardScale').onchange=()=>{document.body.classList.toggle('readable-board',$('boardScale').value==='readable');centreBoard()};
$('startBtn').addEventListener('click',e=>{
 if(!api.game&&read()){e.preventDefault();e.stopImmediatePropagation();api.showModal('Start a new game?', '<p>This replaces the saved game on this device. Choose Cancel to resume it instead.</p>', [{label:'Cancel',action:api.closeModal},{label:'Start new game',primary:true,action:()=>{api.closeModal();api.startGame();setTimeout(centreBoard,0)}}]);return}
 setTimeout(centreBoard,0);
},true);
for(const [id,label] of [['playerCount','Number of players'],['modeSel','Word checking']]){
 $(id).setAttribute('role','group');$(id).setAttribute('aria-label',label);const update=()=>$(id).querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('on'))));update();$(id).addEventListener('click',update);
}
// Capture before the supplied global Enter handler so keyboard placement does not commit accidentally.
document.addEventListener('keydown',e=>{
 if(activeOverlay){if(e.key==='Tab'){const list=[...activeOverlay.querySelectorAll('button,input,select,[tabindex="0"]')].filter(x=>!x.disabled);const index=list.indexOf(document.activeElement);if(list.length){e.preventDefault();e.stopImmediatePropagation();list[(index+(e.shiftKey?-1:1)+list.length)%list.length].focus()}}else if(e.key==='Escape'&&activeOverlay.id==='modal'){e.preventDefault();e.stopImmediatePropagation();$('modal').classList.remove('show')}return}
 const tile=e.target.closest?.('#rack .rtile');if(tile&&['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();api.ui.selected=api.ui.selected===tile.dataset.tile?null:tile.dataset.tile;api.render();document.querySelector('#board .cell[tabindex="0"]')?.focus();return}
 const cell=e.target.closest?.('#board .cell');if(!cell)return;
 const delta={ArrowDown:[0,1],ArrowUp:[0,-1],ArrowRight:[1,0],ArrowLeft:[-1,0]};if(delta[e.key]){e.preventDefault();e.stopImmediatePropagation();const [q,r]=cell.dataset.cell.split(',').map(Number),[dq,dr]=delta[e.key];const next=document.querySelector(`#board .cell[data-cell="${q+dq},${r+dr}"]`);if(next){cell.tabIndex=-1;next.tabIndex=0;next.focus();next.scrollIntoView({block:'nearest',inline:'nearest'})}return}
 if(['Enter',' '].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();const k=cell.dataset.cell;if(api.ui.selected&&!api.game.board[k])api.placeTile(api.ui.selected,k);else if(api.ui.pending.has(k)){api.ui.pending.delete(k);api.render()}return}
},true);
addEventListener('pagehide',save);
})();
