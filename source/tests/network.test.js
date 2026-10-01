import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Multiplayer, normalizeCode } from '../src/network.js';
import { GameSession } from '../src/session.js';

// In-memory signaling/data-channel double: runs the actual multiplayer class
// and authority/session code without depending on a public signaling service.
class Wire extends EventEmitter {
  open=false;
  send(msg) { if (!this.open) throw new Error('closed'); const copy=structuredClone(msg); queueMicrotask(()=>{ if(this.remote.open)this.remote.emit('data',copy); }); }
  close() { if(!this.open)return;this.open=false;this.remote.open=false;this.emit('close');this.remote.emit('close'); }
}
class FakePeer extends EventEmitter {
 static peers=new Map();
 constructor(id) { super();this.id=id||crypto.randomUUID();FakePeer.peers.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id)); }
 connect(id) {
  const local=new Wire(),remote=new Wire();local.remote=remote;remote.remote=local;
  queueMicrotask(()=>{ const target=FakePeer.peers.get(id);if(!target){this.emit('error',{type:'peer-unavailable'});return;}target.emit('connection',remote);queueMicrotask(()=>{local.open=true;remote.open=true;remote.emit('open');local.emit('open');}); });return local;
 }
 destroy(){this.destroyed=true;FakePeer.peers.delete(this.id);}
 reconnect(){this.emit('open',this.id);}
}
const tick=()=>new Promise(r=>setImmediate(r));
function setup() {
 const game=new GameSession(),copy=new GameSession();const hs=[],gs=[];
 let host,guest;
 host=new Multiplayer({status:s=>hs.push(s),room(){},connected(){host.send({type:'state',state:game.snapshot()});},disconnected(){},message(msg){if(msg.type==='sync')host.send({type:'state',state:game.snapshot()});if(msg.type==='action'){try{game.dispatch(msg.action,'b',msg.gameId,msg.revision);}catch{}host.send({type:'state',state:game.snapshot()});}}},FakePeer);
 guest=new Multiplayer({status:s=>gs.push(s),room(){},connected(){},disconnected(){},message(msg){if(msg.type==='state')copy.restore(msg.state);}},FakePeer);
 return {host,guest,game,copy,hs,gs};
}
test('host/guest handshake, turn authority, sync and reconnect with reserved identity',async()=>{
 const {host,guest,game,copy}=setup();try{
 const code=host.host();await tick();guest.join(code);await tick();await tick();assert.equal(host.connected,true);assert.equal(guest.connected,true);assert.equal(game.gameId,copy.gameId);
 game.dispatch({type:'move',from:'e2',to:'e4'},'w');host.send({type:'state',state:game.snapshot()});await tick();
 guest.send({type:'action',action:{type:'move',from:'e7',to:'e5'},gameId:copy.gameId,revision:copy.revision});await tick();await tick();assert.equal(game.rules.fen,copy.rules.fen);assert.equal(game.rules.history.length,2);
 guest.send({type:'action',action:{type:'move',from:'e7',to:'e5'},gameId:copy.gameId,revision:1});await tick();assert.equal(game.rules.history.length,2);
 guest.conn.close();assert.equal(host.connected,false);assert.equal(guest.connected,false);
 guest.retry();await tick();await tick();assert.equal(host.connected,true);assert.equal(copy.rules.fen,game.rules.fen);
 }finally{host.stop();guest.stop();}
});
test('a third player cannot occupy an active or reserved seat',async()=>{
 const {host,guest}=setup();const third=new Multiplayer({status(){},room(){},connected(){},disconnected(){},failure(){},message(){}},FakePeer);
 try{const code=host.host();await tick();guest.join(code);await tick();await tick();third.join(code);await tick();await tick();assert.equal(third.connected,false);assert.equal(guest.connected,true);
 guest.conn.close();third.retry();await tick();await tick();assert.equal(third.connected,false);assert.equal(host.connected,false);
 }finally{host.stop();guest.stop();third.stop();}
});
test('joining validates codes and normalizes pasted formatting',()=>{
 const {host,guest}=setup();try{assert.equal(normalizeCode(' abcd-2345 '),'ABCD2345');assert.throws(()=>guest.join('<script>'));}finally{host.stop();guest.stop();}
});
