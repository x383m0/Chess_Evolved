import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../src/session.js';
import { ClassicRules } from '../src/rules.js';
const move = (s,from,to,promotion) => s.dispatch({type:'move',from,to,promotion},s.rules.turn);
test('reject illegal, out-of-turn and stale moves without mutation',()=>{
 const s=new GameSession(), initial=s.snapshot();
 assert.throws(()=>s.dispatch({type:'move',from:'e2',to:'e4'},'b'));
 assert.throws(()=>move(s,'e2','e5'));
 assert.deepEqual(s.snapshot(),initial);
 move(s,'e2','e4');
 assert.throws(()=>s.dispatch({type:'move',from:'e7',to:'e5'},'b',s.gameId,0));
 assert.equal(s.rules.history.length,1);
});
test('Fool’s mate blocks moves and requires both players to rematch',()=>{
 const s=new GameSession(); move(s,'f2','f3');move(s,'e7','e5');move(s,'g2','g4');move(s,'d8','h4');
 assert.deepEqual(s.result,{winner:'b',reason:'Checkmate'});
 assert.throws(()=>move(s,'a2','a3'));
 const old=s.gameId;s.dispatch({type:'rematch'},'w');assert.equal(s.gameId,old);
 s.dispatch({type:'rematch'},'b');assert.notEqual(s.gameId,old);assert.equal(s.rules.history.length,0);
});
test('restore preserves repetition history and rejects tampered FEN',()=>{
 const s=new GameSession();for(let i=0;i<2;i++){move(s,'g1','f3');move(s,'g8','f6');move(s,'f3','g1');move(s,'f6','g8');}
 const copy=new GameSession();copy.restore(s.snapshot());assert.equal(copy.result.reason,'Threefold repetition');
 const old=copy.snapshot();assert.throws(()=>copy.restore({...s.snapshot(),fen:new GameSession().rules.fen.replace(' w ',' b ')}));assert.deepEqual(copy.snapshot(),old);
});
test('castling and en passant',()=>{
 const s=new GameSession(); for(const [f,t] of [['e2','e4'],['a7','a6'],['g1','f3'],['a6','a5'],['f1','e2'],['b7','b6'],['e1','g1']]) move(s,f,t);
 assert.equal(s.rules.piece('f1').type,'r');assert.equal(s.rules.piece('g1').type,'k');
 const e=new GameSession();for(const [f,t] of [['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5'],['e5','d6']])move(e,f,t);
 assert.equal(e.rules.piece('d5'),undefined);assert.equal(e.rules.piece('d6').type,'p');
});
test('promotion, stalemate and insufficient material',()=>{
 const r=new ClassicRules();r.chess.load('7k/P7/8/8/8/8/8/7K w - - 0 1');
 r.apply({type:'move',from:'a7',to:'a8',promotion:'n'});assert.equal(r.piece('a8').type,'n');assert.equal(r.result().reason,'Insufficient material');
 r.chess.load('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');assert.equal(r.result().reason,'Stalemate');
});
test('draw offers only accepted by the opponent; moves clear offers',()=>{
 const s=new GameSession();s.dispatch({type:'offer-draw'},'w');assert.throws(()=>s.dispatch({type:'accept-draw'},'w'));move(s,'e2','e4');assert.equal(s.drawOffer,null);
 s.dispatch({type:'offer-draw'},'b');s.dispatch({type:'accept-draw'},'w');assert.equal(s.result.reason,'Draw by agreement');
});
test('resignation, invalid action and incompatible variants',()=>{
 const s=new GameSession();assert.throws(()=>s.dispatch({type:'ability'},'w'));assert.throws(()=>s.restore({...s.snapshot(),ruleset:{id:'custom',version:1}}));
 s.dispatch({type:'resign'},'b');assert.equal(s.result.winner,'w');
});
